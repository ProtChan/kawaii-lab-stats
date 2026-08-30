"""LIGHT FX collector."""

from __future__ import annotations

from .base import BaseCollector


class LightFxCollector(BaseCollector):
    broker = "LIGHT FX"
    source_url = "https://lightfx.jp/market/swap/"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
