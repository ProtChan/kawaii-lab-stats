"""外為どっとコム collector."""

from __future__ import annotations

from .base import BaseCollector


class GaitameCollector(BaseCollector):
    broker = "外為どっとコム"
    source_url = "https://www.gaitame.com/markets/rate/"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
