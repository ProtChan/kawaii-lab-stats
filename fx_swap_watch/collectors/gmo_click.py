"""GMOクリック証券 FXネオ collector."""

from __future__ import annotations

from .base import BaseCollector


class GmoClickCollector(BaseCollector):
    broker = "GMOクリック証券 FXネオ"
    source_url = "https://www.click-sec.com/corp/guide/fxneo/swplog/"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
