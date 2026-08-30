"""Base collector and resilient HTML table parsing utilities."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from datetime import date
from html.parser import HTMLParser
from typing import TYPE_CHECKING, Iterable

try:
    from bs4 import BeautifulSoup
except ModuleNotFoundError:
    BeautifulSoup = None

if TYPE_CHECKING:
    import requests

from fx_swap_watch.constants import TARGET_PAIRS
from fx_swap_watch.schema import make_row

NUMBER_RE = re.compile(r"[-+−]?\d+(?:,\d{3})*(?:\.\d+)?")


class CollectorError(RuntimeError):
    """Raised when a collector cannot produce any usable rows."""


class BaseCollector(ABC):
    broker: str
    source_url: str
    value_date: str | None = None
    timeout = 20

    def fetch_html(self, session: "requests.Session") -> str:
        response = session.get(self.source_url, timeout=self.timeout)
        response.raise_for_status()
        return response.text

    def collect(self, session: "requests.Session", captured_at: str) -> tuple[list[dict], list[dict]]:
        try:
            html = self.fetch_html(session)
            rows = self.parse(html, captured_at)
            if not rows:
                raise CollectorError("対象通貨ペアのスワップポイントを抽出できませんでした")
            return rows, []
        except Exception as exc:
            error = {"broker": self.broker, "source_url": self.source_url, "message": f"{type(exc).__name__}: {exc}"}
            return [self.error_row(captured_at, error["message"])], [error]

    @abstractmethod
    def parse(self, html: str, captured_at: str) -> list[dict]:
        """Parse broker HTML into standard rows."""

    def error_row(self, captured_at: str, message: str) -> dict:
        return make_row(captured_at=captured_at, broker=self.broker, pair="", side="", source_url=self.source_url, error=message)

    def parse_generic_tables(self, html: str, captured_at: str) -> list[dict]:
        tables = self._extract_tables(html)
        rows: list[dict] = []
        for table in tables:
            header_texts = self._header_texts(table)
            for tr in self._table_rows(table):
                cells = self._row_cells(tr)
                if len(cells) < 2:
                    continue
                pair = self._detect_pair(" ".join(cells))
                if not pair:
                    continue
                buy_index = self._find_column(header_texts, ("買", "買Swap", "買SW", "受取", "ロング"))
                sell_index = self._find_column(header_texts, ("売", "売Swap", "売SW", "支払", "ショート"))
                days_index = self._find_column(header_texts, ("付与日数", "日数", "days"))
                if buy_index is None or sell_index is None:
                    numeric_cells = [(index, value) for index, value in enumerate(cells) if self._to_float(value) is not None]
                    if len(numeric_cells) >= 2:
                        sell_index = numeric_cells[-2][0]
                        buy_index = numeric_cells[-1][0]
                days = self._to_int(cells[days_index]) if days_index is not None and days_index < len(cells) else 1
                days = days or 1
                for side, index in (("sell", sell_index), ("buy", buy_index)):
                    if index is None or index >= len(cells):
                        continue
                    raw_value = cells[index]
                    swap_points = self._to_float(raw_value)
                    if swap_points is None:
                        continue
                    rows.append(make_row(captured_at=captured_at, value_date=self.value_date or date.today().isoformat(), broker=self.broker, pair=pair, side=side, swap_points=swap_points, raw_value=raw_value, days=days, source_url=self.source_url))
        return self._dedupe(rows)

    @classmethod
    def _extract_tables(cls, html: str):
        if BeautifulSoup is not None:
            return BeautifulSoup(html, "html.parser").find_all("table")
        parser = _SimpleTableParser()
        parser.feed(html)
        return parser.tables

    @staticmethod
    def _table_rows(table):
        if isinstance(table, list):
            return table
        return table.find_all("tr")

    @classmethod
    def _row_cells(cls, row) -> list[str]:
        if isinstance(row, list):
            return row
        return [cell.get_text(" ", strip=True) for cell in row.find_all(["td", "th"])]

    @classmethod
    def _header_texts(cls, table) -> list[str]:
        if isinstance(table, list):
            return table[0] if table else []
        first_row = table.find("tr")
        if not first_row:
            return []
        return cls._row_cells(first_row)

    @staticmethod
    def _find_column(headers: Iterable[str], needles: Iterable[str]) -> int | None:
        for index, header in enumerate(headers):
            normalized = header.replace(" ", "")
            if any(needle.lower() in normalized.lower() for needle in needles):
                return index
        return None

    @staticmethod
    def _detect_pair(text: str) -> str | None:
        compact = text.replace(" ", "").replace("／", "/")
        for pair, aliases in TARGET_PAIRS.items():
            for alias in aliases:
                if alias.replace(" ", "") in compact:
                    return pair
        return None

    @staticmethod
    def _to_float(value: str) -> float | None:
        match = NUMBER_RE.search(value.replace("−", "-"))
        if not match:
            return None
        return float(match.group(0).replace(",", ""))

    @classmethod
    def _to_int(cls, value: str) -> int | None:
        number = cls._to_float(value)
        return int(number) if number is not None else None

    @staticmethod
    def _dedupe(rows: list[dict]) -> list[dict]:
        seen: set[tuple[str, str, str]] = set()
        unique: list[dict] = []
        for row in rows:
            key = (row["broker"], row["pair"], row["side"])
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique


class _SimpleTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._in_table = False
        self._in_cell = False
        self._current_table: list[list[str]] = []
        self._current_row: list[str] = []
        self._current_cell: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "table":
            self._in_table = True
            self._current_table = []
        elif self._in_table and tag == "tr":
            self._current_row = []
        elif self._in_table and tag in {"td", "th"}:
            self._in_cell = True
            self._current_cell = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._in_table and tag in {"td", "th"}:
            self._current_row.append(" ".join(part.strip() for part in self._current_cell if part.strip()))
            self._in_cell = False
        elif self._in_table and tag == "tr" and self._current_row:
            self._current_table.append(self._current_row)
        elif tag == "table" and self._in_table:
            self.tables.append(self._current_table)
            self._in_table = False
