"""みんなのFX collector."""

from __future__ import annotations

from .base import BaseCollector


class MinFxCollector(BaseCollector):
    broker = "みんなのFX"
    source_url = "https://min-fx.jp/market/swap/"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
