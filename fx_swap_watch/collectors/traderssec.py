"""Parser for the shared Minna no FX / LIGHT FX recent-swap table."""

from __future__ import annotations

import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from fx_swap_watch.constants import TARGET_PAIRS
from fx_swap_watch.schema import make_row

JST = ZoneInfo("Asia/Tokyo")
DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})")
NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def parse_recent_pair_table(html: str, captured_at: str, broker: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    today = datetime.fromisoformat(captured_at).astimezone(JST).date()

    best = None
    for table in soup.find_all("table"):
        table_rows = table.find_all("tr")
        pair_rows = []
        first_pair_index = None
        for index, tr in enumerate(table_rows):
            cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
            if not cells:
                continue
            pair = _detect_pair(cells[0])
            if pair and len(cells) >= 4:
                if first_pair_index is None:
                    first_pair_index = index
                pair_rows.append((pair, cells))

        if len({pair for pair, _ in pair_rows}) < 5 or first_pair_index is None:
            continue

        header_text = " ".join(
            cell.get_text(" ", strip=True)
            for tr in table_rows[:first_pair_index]
            for cell in tr.find_all(["td", "th"])
        )
        header_dates = _dedupe_dates(DATE_RE.findall(header_text))
        if not header_dates:
            continue

        score = len({pair for pair, _ in pair_rows})
        if best is None or score > best[0]:
            best = (score, header_dates, pair_rows)

    if best is None:
        return []

    _, header_dates, pair_rows = best
    print(f"{broker} recent-table dates={header_dates}")
    for pair, cells in pair_rows:
        if pair == "GBPJPY":
            print(f"{broker} GBPJPY cells={cells}")

    rows: list[dict] = []
    seen_pairs: set[str] = set()
    for pair, cells in pair_rows:
        if pair in seen_pairs:
            continue
        payload = cells[1:]
        triples = [payload[index:index + 3] for index in range(0, len(payload), 3)]
        usable = min(len(triples), len(header_dates))

        selected = None
        for index in range(usable - 1, -1, -1):
            triple = triples[index]
            if len(triple) != 3:
                continue
            days_raw = triple[0].replace(",", "").strip()
            buy_raw = triple[1].replace(",", "").strip()
            sell_raw = triple[2].replace(",", "").strip()
            if not (NUMBER_RE.fullmatch(days_raw) and NUMBER_RE.fullmatch(buy_raw) and NUMBER_RE.fullmatch(sell_raw)):
                continue
            days = int(float(days_raw))
            if days <= 0:
                continue
            month, day = header_dates[index]
            value_date = _resolve_date(today, int(month), int(day))
            selected = (value_date, days, float(buy_raw), float(sell_raw), buy_raw, sell_raw)
            break

        if selected is None:
            continue

        value_date, days, buy, sell, buy_raw, sell_raw = selected
        seen_pairs.add(pair)
        rows.extend([
            make_row(captured_at=captured_at, value_date=value_date.isoformat(), broker=broker, pair=pair, side="buy", swap_points=buy, raw_value=buy_raw, days=days, source_url=source_url),
            make_row(captured_at=captured_at, value_date=value_date.isoformat(), broker=broker, pair=pair, side="sell", swap_points=sell, raw_value=sell_raw, days=days, source_url=source_url),
        ])

    return rows


def _detect_pair(text: str) -> str | None:
    compact = text.replace(" ", "").replace("／", "/")
    for pair, aliases in TARGET_PAIRS.items():
        if pair in compact:
            return pair
        for alias in aliases:
            if alias.replace(" ", "") in compact:
                return pair
    return None


def _dedupe_dates(matches: list[tuple[str, str]]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for item in matches:
        if item not in result:
            result.append(item)
    return result


def _resolve_date(today: date, month: int, day: int) -> date:
    candidate = date(today.year, month, day)
    if candidate > today:
        candidate = date(today.year - 1, month, day)
    return candidate
