"""Shared parser for the Minna no FX / LIGHT FX swap calendar."""

from __future__ import annotations

import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from fx_swap_watch.constants import TARGET_PAIRS
from fx_swap_watch.schema import make_row

JST = ZoneInfo("Asia/Tokyo")
DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})")
PAIR_CODE_RE = re.compile(r"\b([A-Z]{6})\b")
NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def parse_recent_pair_table(html: str, captured_at: str, broker: str, source_url: str) -> list[dict]:
    """Return the latest valid calendar entry for every target pair.

    The small "recent swaps" matrix can contain only a zero-day row plus a future
    unpublished row (for example GBPJPY around a holiday/weekend).  The full
    calendar on the same official page retains older valid rows, so use that as
    the authoritative source and choose the newest numeric row with days > 0 for
    each pair.
    """
    soup = BeautifulSoup(html, "html.parser")
    today = datetime.fromisoformat(captured_at).astimezone(JST).date()

    selected: dict[str, tuple[date, int, float, float, str, str]] = {}

    for table in soup.find_all("table"):
        row_cells = [
            [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
            for tr in table.find_all("tr")
        ]
        row_cells = [cells for cells in row_cells if cells]
        if not row_cells:
            continue

        header_index = None
        all_pairs: list[str] = []
        for index, cells in enumerate(row_cells):
            codes = _pair_codes(cells)
            target_count = sum(code in TARGET_PAIRS for code in codes)
            if target_count >= 5:
                header_index = index
                all_pairs = codes
                break
        if header_index is None or not all_pairs:
            continue

        pair_positions = {pair: all_pairs.index(pair) for pair in TARGET_PAIRS if pair in all_pairs}
        if len(pair_positions) < 5:
            continue

        index = header_index + 1
        while index < len(row_cells):
            cells = row_cells[index]
            date_match = DATE_RE.search(cells[0]) if cells else None
            if not date_match:
                index += 1
                continue

            month, day = map(int, date_match.groups())
            value_date = _resolve_date(today, month, day)

            days_values = _calendar_payload(cells, "days", len(all_pairs))
            buy_values = None
            sell_values = None

            cursor = index + 1
            while cursor < len(row_cells):
                next_cells = row_cells[cursor]
                if DATE_RE.search(next_cells[0]):
                    break
                label = next_cells[0].replace(" ", "")
                if label.startswith("買"):
                    buy_values = _calendar_payload(next_cells, "side", len(all_pairs))
                elif label.startswith("売"):
                    sell_values = _calendar_payload(next_cells, "side", len(all_pairs))
                cursor += 1

            if value_date <= today and days_values is not None and buy_values is not None and sell_values is not None:
                for pair, position in pair_positions.items():
                    if position >= len(days_values) or position >= len(buy_values) or position >= len(sell_values):
                        continue
                    days_raw = _clean(days_values[position])
                    buy_raw = _clean(buy_values[position])
                    sell_raw = _clean(sell_values[position])
                    if not (NUMBER_RE.fullmatch(days_raw) and NUMBER_RE.fullmatch(buy_raw) and NUMBER_RE.fullmatch(sell_raw)):
                        continue
                    days = int(float(days_raw))
                    if days <= 0:
                        continue
                    prior = selected.get(pair)
                    if prior is None or value_date > prior[0]:
                        selected[pair] = (
                            value_date,
                            days,
                            float(buy_raw),
                            float(sell_raw),
                            buy_raw,
                            sell_raw,
                        )

            index = max(cursor, index + 1)

    rows: list[dict] = []
    for pair in TARGET_PAIRS:
        item = selected.get(pair)
        if item is None:
            continue
        value_date, days, buy, sell, buy_raw, sell_raw = item
        rows.extend([
            make_row(
                captured_at=captured_at,
                value_date=value_date.isoformat(),
                broker=broker,
                pair=pair,
                side="buy",
                swap_points=buy,
                raw_value=buy_raw,
                days=days,
                source_url=source_url,
            ),
            make_row(
                captured_at=captured_at,
                value_date=value_date.isoformat(),
                broker=broker,
                pair=pair,
                side="sell",
                swap_points=sell,
                raw_value=sell_raw,
                days=days,
                source_url=source_url,
            ),
        ])
    return rows


def _pair_codes(cells: list[str]) -> list[str]:
    codes: list[str] = []
    for cell in cells:
        match = PAIR_CODE_RE.search(cell.upper())
        if match and match.group(1) not in codes:
            codes.append(match.group(1))
    return codes


def _calendar_payload(cells: list[str], kind: str, expected: int) -> list[str] | None:
    if kind == "days":
        # Date rows are: date, 付与日数, pair1, pair2, ...
        if len(cells) >= expected + 2 and "付与" in cells[1]:
            return cells[2:2 + expected]
        if len(cells) >= expected + 1:
            return cells[-expected:]
        return None

    # Buy/sell rows are: 買|売, pair1, pair2, ...
    if len(cells) >= expected + 1:
        return cells[1:1 + expected] if len(cells) == expected + 1 else cells[-expected:]
    return None


def _clean(value: str) -> str:
    return value.replace(",", "").replace("−", "-").strip()


def _resolve_date(today: date, month: int, day: int) -> date:
    candidate = date(today.year, month, day)
    # Around New Year, a December row displayed in January belongs to last year.
    if candidate > today and (candidate - today).days > 180:
        candidate = date(today.year - 1, month, day)
    return candidate
