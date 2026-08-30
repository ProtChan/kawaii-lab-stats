"""外為どっとコム collector."""

from __future__ import annotations

import csv
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fx_swap_watch.constants import TARGET_PAIRS
from fx_swap_watch.schema import make_row
from .base import BaseCollector, CollectorError

JST = ZoneInfo("Asia/Tokyo")
PAIR_KEY_RE = re.compile(r'''[\"']([a-z]{6})[\"']\s*:\s*\{''')
DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})")
INTEGER_RE = re.compile(r"^-?\d+$")


class GaitameCollector(BaseCollector):
    broker = "外為どっとコム"
    source_url = "https://www.gaitame.com/service/fx/swap-cal.html"
    csv_url_template = "https://www.gaitame.com/products/nextneo/csv/{year}{month:02d}.csv"

    def collect(self, session, captured_at: str) -> tuple[list[dict], list[dict]]:
        try:
            page = self.fetch_html(session)
            pair_order = self._extract_pair_order(page)
            today = datetime.fromisoformat(captured_at).astimezone(JST).date()

            month_keys = [(today.year, today.month)]
            if today.month == 1:
                month_keys.append((today.year - 1, 12))
            else:
                month_keys.append((today.year, today.month - 1))

            monthly_rows: list[tuple[int, int, list[list[str]], str]] = []
            for year, month in month_keys:
                url = self.csv_url_template.format(year=year, month=month)
                response = session.get(url, timeout=self.timeout)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                response.encoding = "shift_jis"
                records = list(csv.reader(response.text.splitlines()))
                monthly_rows.append((year, month, records, url))

            rows: list[dict] = []
            errors: list[dict] = []
            for pair in TARGET_PAIRS:
                key = pair.lower()
                if key not in pair_order:
                    errors.append({
                        "broker": self.broker,
                        "source_url": self.source_url,
                        "message": f"{pair}: 通貨ペア定義を取得できませんでした",
                    })
                    continue

                pair_index = pair_order.index(key)
                base_index = pair_index * 3 + 1
                selected = None

                for year, _month, records, source_url in monthly_rows:
                    candidates = []
                    for fields in records:
                        if len(fields) <= base_index + 2:
                            continue
                        date_match = DATE_RE.match(fields[0].strip())
                        if not date_match:
                            continue
                        month_num, day_num = map(int, date_match.groups())
                        try:
                            value_date = datetime(year, month_num, day_num).date()
                        except ValueError:
                            continue
                        if value_date > today or value_date.weekday() >= 5:
                            continue

                        days_raw = fields[base_index].strip()
                        buy_raw = fields[base_index + 1].strip()
                        sell_raw = fields[base_index + 2].strip()
                        if not (INTEGER_RE.fullmatch(days_raw) and INTEGER_RE.fullmatch(buy_raw) and INTEGER_RE.fullmatch(sell_raw)):
                            continue
                        days = int(days_raw)
                        if days <= 0:
                            continue
                        candidates.append((value_date, days, int(buy_raw), int(sell_raw), buy_raw, sell_raw, source_url))

                    if candidates:
                        selected = max(candidates, key=lambda item: item[0])
                        break

                if selected is None:
                    errors.append({
                        "broker": self.broker,
                        "source_url": self.source_url,
                        "message": f"{pair}: 最新の有効なスワップ行を取得できませんでした",
                    })
                    continue

                value_date, days, buy, sell, buy_raw, sell_raw, source_url = selected
                unit = 100_000 if pair == "HUFJPY" else 10_000
                rows.extend([
                    make_row(
                        captured_at=captured_at,
                        value_date=value_date.isoformat(),
                        broker=self.broker,
                        pair=pair,
                        side="buy",
                        swap_points=buy,
                        raw_value=buy_raw,
                        days=days,
                        unit=unit,
                        source_url=source_url,
                    ),
                    make_row(
                        captured_at=captured_at,
                        value_date=value_date.isoformat(),
                        broker=self.broker,
                        pair=pair,
                        side="sell",
                        swap_points=sell,
                        raw_value=sell_raw,
                        days=days,
                        unit=unit,
                        source_url=source_url,
                    ),
                ])

            if not rows:
                raise CollectorError("対象通貨ペアのスワップポイントを抽出できませんでした")
            return rows, errors
        except Exception as exc:
            error = {
                "broker": self.broker,
                "source_url": self.source_url,
                "message": f"{type(exc).__name__}: {exc}",
            }
            return [self.error_row(captured_at, error["message"])], [error]

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)

    @staticmethod
    def _extract_pair_order(html: str) -> list[str]:
        marker = "const currencies ="
        start = html.find(marker)
        if start < 0:
            raise CollectorError("通貨ペア定義が見つかりません")
        end = html.find("};", start)
        if end < 0:
            raise CollectorError("通貨ペア定義の終端が見つかりません")
        keys = PAIR_KEY_RE.findall(html[start:end])
        if not keys:
            raise CollectorError("通貨ペア定義を解析できません")
        return keys
