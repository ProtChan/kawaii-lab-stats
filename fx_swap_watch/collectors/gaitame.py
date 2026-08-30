"""外為どっとコム collector."""

from __future__ import annotations

from .base import BaseCollector, CollectorError


class GaitameCollector(BaseCollector):
    broker = "外為どっとコム"
    source_url = "https://www.gaitame.com/service/fx/swap-cal.html"

    def collect(self, session, captured_at: str) -> tuple[list[dict], list[dict]]:
        try:
            html = self.fetch_html(session)
            rows = self.parse(html, captured_at)
            if rows:
                return rows, []

            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "html.parser")
            for script in soup.find_all("script"):
                if script.get("src"):
                    continue
                raw = script.string or ""
                marker = "function fetchSwapData"
                index = raw.find(marker)
                if index >= 0:
                    print("gaitame raw fetchSwapData:")
                    print(raw[index:index + 5000])
                    break
            raise CollectorError("対象通貨ペアのスワップポイントを抽出できませんでした")
        except Exception as exc:
            error = {"broker": self.broker, "source_url": self.source_url, "message": f"{type(exc).__name__}: {exc}"}
            return [self.error_row(captured_at, error["message"])], [error]

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
