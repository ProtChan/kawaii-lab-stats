"""LIGHT FX collector."""

from __future__ import annotations

from .base import BaseCollector
from .traderssec import parse_recent_pair_table


class LightFxCollector(BaseCollector):
    broker = "LIGHT FX"
    source_url = "https://lightfx.jp/market/swap/"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        rows = parse_recent_pair_table(html, captured_at, self.broker, self.source_url)
        return rows or self.parse_generic_tables(html, captured_at)
