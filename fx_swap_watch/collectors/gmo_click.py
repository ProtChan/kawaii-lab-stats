"""GMOクリック証券 FXネオ collector."""

from __future__ import annotations

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fx_swap_watch.constants import TARGET_PAIRS
from fx_swap_watch.schema import make_row
from .base import BaseCollector

JST = ZoneInfo("Asia/Tokyo")
DATE_RE = re.compile(r"(\d{1,2})月(\d{1,2})日")
INTEGER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


class GmoClickCollector(BaseCollector):
    broker = "GMOクリック証券 FXネオ"
    source_url = "https://www.click-sec.com/corp/guide/fxneo/swplog/"

    def collect(self, session, captured_at: str) -> tuple[list[dict], list[dict]]:
        from bs4 import BeautifulSoup

        today = datetime.fromisoformat(captured_at).astimezone(JST).date()
        month_keys = [(today.year, today.month)]
        if today.month == 1:
            month_keys.append((today.year - 1, 12))
        else:
            month_keys.append((today.year, today.month - 1))

        rows: list[dict] = []
        errors: list[dict] = []

        for pair in TARGET_PAIRS:
            selected = None
            last_url = self.source_url

            for year, month in month_keys:
                url = f"{self.source_url}?year={year}&month={month:02d}&pare={pair}"
                last_url = url
                try:
                    response = session.get(url, timeout=self.timeout)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "html.parser")
                    table = self._find_calendar_table(soup)
                    if table is None:
                        continue

                    candidates = []
                    for tr in table.find_all("tr"):
                        cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
                        if len(cells) < 4:
                            continue
                        match = DATE_RE.search(cells[0])
                        if not match:
                            continue
                        month_num, day_num = map(int, match.groups())
                        try:
                            value_date = datetime(year, month_num, day_num).date()
                        except ValueError:
                            continue
                        if value_date > today:
                            continue

                        sell_raw = cells[1].replace(",", "").strip()
                        buy_raw = cells[2].replace(",", "").strip()
                        days_raw = cells[3].strip()
                        if not (INTEGER_RE.fullmatch(sell_raw) and INTEGER_RE.fullmatch(buy_raw)):
                            continue
                        try:
                            days = int(float(days_raw))
                        except ValueError:
                            continue
                        if days <= 0:
                            continue

                        candidates.append((value_date, float(sell_raw), float(buy_raw), days, sell_raw, buy_raw, url))

                    if candidates:
                        selected = max(candidates, key=lambda item: item[0])
                        break
                except Exception as exc:
                    errors.append({
                        "broker": self.broker,
                        "source_url": url,
                        "message": f"{pair}: {type(exc).__name__}: {exc}",
                    })

            if selected is None:
                errors.append({
                    "broker": self.broker,
                    "source_url": last_url,
                    "message": f"{pair}: 最新の有効なスワップ行を取得できませんでした",
                })
                continue

            value_date, sell, buy, days, sell_raw, buy_raw, source_url = selected
            rows.extend([
                make_row(
                    captured_at=captured_at,
                    value_date=value_date.isoformat(),
                    broker=self.broker,
                    pair=pair,
                    side="sell",
                    swap_points=sell,
                    raw_value=sell_raw,
                    days=days,
                    source_url=source_url,
                ),
                make_row(
                    captured_at=captured_at,
                    value_date=value_date.isoformat(),
                    broker=self.broker,
                    pair=pair,
                    side="buy",
                    swap_points=buy,
                    raw_value=buy_raw,
                    days=days,
                    source_url=source_url,
                ),
            ])

        if not rows:
            error = {
                "broker": self.broker,
                "source_url": self.source_url,
                "message": "CollectorError: 対象通貨ペアのスワップポイントを抽出できませんでした",
            }
            return [self.error_row(captured_at, error["message"])], errors + [error]
        return rows, errors

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)

    @staticmethod
    def _find_calendar_table(soup):
        for table in soup.find_all("table"):
            first_row = table.find("tr")
            if not first_row:
                continue
            headers = [cell.get_text(" ", strip=True) for cell in first_row.find_all(["th", "td"])]
            joined = " ".join(headers)
            if all(label in joined for label in ("取引日", "売Swap", "買Swap", "付与日数")):
                return table
        return None
