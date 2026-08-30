"""外為どっとコム collector."""

from __future__ import annotations

from .base import BaseCollector


class GaitameCollector(BaseCollector):
    broker = "外為どっとコム"
    source_url = "https://www.gaitame.com/service/fx/swap-cal.html"

    def parse(self, html: str, captured_at: str) -> list[dict]:
        rows = self.parse_generic_tables(html, captured_at)
        if rows:
            return rows

        # The calendar is JavaScript-rendered. Keep this compact diagnostic in
        # Actions logs while locating the official data feed used by the page.
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "html.parser")
            scripts = [tag.get("src") for tag in soup.find_all("script") if tag.get("src")]
            print("gaitame script sources:")
            for src in scripts:
                print(src)
        except Exception as exc:  # pragma: no cover - diagnostics only
            print(f"gaitame script-source diagnostic failed: {exc}")
        return []
