#!/usr/bin/env python3
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from curl_cffi import requests

ROOT = Path.cwd()
LIVE_DIR = ROOT / "data" / "live"
PUBLIC_DIR = ROOT / "public" / "data"
RETRY_HOURS = 6
FORCE = os.getenv("FORCE_INSTAGRAM_CFFI") == "1"

def jst_date_key():
    return datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d")

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def account_key(row):
    return f"{row.get('platform')}:{str(row.get('handle','')).lower()}"

def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)

def clean_base(row):
    drop = {
        "error", "detail", "imputed", "imputationMethod", "imputedFromDate",
        "imputedFromCapturedAt", "imputedAt", "imputedSourceType",
        "acquisitionError", "nextRetryAt", "retryBackoffMinutes",
        "fallbackErrors",
    }
    return {k: v for k, v in row.items() if k not in drop}

def write_snapshot(snapshot):
    serialized = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    (PUBLIC_DIR / "history").mkdir(parents=True, exist_ok=True)
    for path in (
        LIVE_DIR / "history" / f"{snapshot['date']}.json",
        LIVE_DIR / "latest.json",
        PUBLIC_DIR / "history" / f"{snapshot['date']}.json",
        PUBLIC_DIR / "latest.json",
    ):
        path.write_text(serialized, encoding="utf-8")

def parse_user(row, payload, captured_at, source_url):
    user = (payload.get("data") or {}).get("user")
    if not isinstance(user, dict):
        raise ValueError("web_profile_info returned no user")
    followers = ((user.get("edge_followed_by") or {}).get("count"))
    if not finite(followers):
        raise ValueError("web_profile_info returned no follower count")
    following = ((user.get("edge_follow") or {}).get("count"))
    posts = ((user.get("edge_owner_to_timeline_media") or {}).get("count"))
    base = clean_base(row)
    base.update({
        "capturedAt": captured_at,
        "sourceType": "INSTAGRAM_CURL_CFFI_WEB_PROFILE_INFO",
        "sourceUrl": source_url,
        "providerPlatform": "instagram",
        "providerHandle": user.get("username") or row.get("handle"),
        "providerName": user.get("full_name") or row.get("entityName"),
        "followers": int(followers),
        "following": int(following) if finite(following) else None,
        "posts": int(posts) if finite(posts) else None,
        "likes": None,
        "views": None,
        "verified": user.get("is_verified"),
        "avatar": user.get("profile_pic_url_hd") or user.get("profile_pic_url"),
        "audienceMetric": "FOLLOWERS",
        "precision": "PUBLIC_EXACT",
        "engagementMetric": None,
    })
    return base

def main():
    latest_path = LIVE_DIR / "latest.json"
    snapshot = read_json(latest_path)
    today = jst_date_key()
    if snapshot.get("date") != today:
        print(f"Latest snapshot is {snapshot.get('date')}, not {today}; curl_cffi Instagram fallback skipped.")
        return

    targets = [
        row for row in snapshot.get("accounts", [])
        if row.get("platform") == "INSTAGRAM" and (row.get("error") or row.get("imputed") is True)
    ]
    if not targets:
        print("Instagram is already fully observed; curl_cffi fallback skipped.")
        return

    previous = snapshot.get("instagramCffiAttemptAt")
    if previous and not FORCE:
        try:
            then = datetime.fromisoformat(previous.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - then < timedelta(hours=RETRY_HOURS):
                print(f"curl_cffi Instagram route is inside 6h backoff; retaining {len(targets)} unresolved/fallback row(s).")
                return
        except ValueError:
            pass

    captured_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    session = requests.Session(impersonate="chrome")
    session.headers.update({
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "198387",
        "Origin": "https://www.instagram.com",
    })

    bootstrap_error = None
    try:
        session.get("https://www.instagram.com/", timeout=20, allow_redirects=True)
    except Exception as exc:
        bootstrap_error = str(exc)

    replacements = {}
    errors = []
    attempts = 0
    blocked = 0
    consecutive_blocked = 0

    for row in targets:
        username = str(row.get("handle", "")).lstrip("@")
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        attempts += 1
        try:
            headers = {"Referer": f"https://www.instagram.com/{username}/"}
            csrf = session.cookies.get("csrftoken")
            if csrf:
                headers["X-CSRFToken"] = csrf
            response = session.get(url, headers=headers, timeout=25, allow_redirects=True)
            if response.status_code in (401, 403, 429):
                blocked += 1
                consecutive_blocked += 1
                errors.append(f"@{username}: HTTP {response.status_code}: {response.text[:180]}")
                if consecutive_blocked >= 2:
                    print("curl_cffi Instagram circuit opened after two consecutive blocking responses.")
                    break
                continue
            response.raise_for_status()
            payload = response.json()
            replacements[account_key(row)] = parse_user(row, payload, captured_at, url)
            consecutive_blocked = 0
            time.sleep(0.8)
        except Exception as exc:
            message = str(exc)
            errors.append(f"@{username}: {message}")
            if any(code in message for code in ("401", "403", "429")):
                blocked += 1
                consecutive_blocked += 1
                if consecutive_blocked >= 2:
                    print("curl_cffi Instagram circuit opened after two consecutive blocking responses.")
                    break
            else:
                consecutive_blocked = 0

    accounts = [replacements.get(account_key(row), row) for row in snapshot.get("accounts", [])]
    failed_rows = [row for row in accounts if row.get("error")]
    imputed_rows = [row for row in accounts if not row.get("error") and row.get("imputed") is True]
    observed_rows = [row for row in accounts if not row.get("error") and not row.get("imputed")]

    snapshot.update({
        "complete": len(failed_rows) == 0,
        "observedComplete": len(failed_rows) == 0 and len(imputed_rows) == 0,
        "attempted": len(accounts),
        "successful": len(accounts) - len(failed_rows),
        "observedSuccessful": len(observed_rows),
        "failed": len(failed_rows),
        "imputed": len(imputed_rows),
        "instagramCffiAttemptAt": captured_at,
        "instagramCffiRouteHealth": {
            "attemptedAt": captured_at,
            "route": "CURL_CFFI_WEB_PROFILE_INFO",
            "targets": len(targets),
            "attempts": attempts,
            "recovered": len(replacements),
            "blocked": blocked,
            "bootstrapError": bootstrap_error,
            "lastErrors": errors[-8:],
        },
        "accounts": accounts,
        "errors": [
            f"{row.get('entitySlug')}:{row.get('platform')}:{row.get('handle')}: {row.get('detail') or row.get('error')}"
            for row in failed_rows
        ],
    })
    write_snapshot(snapshot)
    print(
        f"curl_cffi Instagram fallback recovered {len(replacements)}/{len(targets)}; "
        f"observed={len(observed_rows)}, imputed={len(imputed_rows)}, hard-failed={len(failed_rows)}."
    )

if __name__ == "__main__":
    main()
