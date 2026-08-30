"""外為どっとコム collector."""

from __future__ import annotations

import re
from urllib.parse import urljoin

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
            scripts = [tag.get("src") for tag in soup.find_all("script") if tag.get("src")]
            for src in scripts:
                script_url = urljoin(self.source_url, src)
                if "gaitame.com" not in script_url:
                    continue
                response = session.get(script_url, timeout=self.timeout)
                response.raise_for_status()
                text = response.text
                matches = []
                for match in re.finditer(r"swap", text, flags=re.IGNORECASE):
                    start = max(0, match.start() - 240)
                    end = min(len(text), match.end() + 360)
                    snippet = text[start:end].replace("\n", " ")
                    if snippet not in matches:
                        matches.append(snippet)
                    if len(matches) >= 20:
                        break
                print(f"gaitame diagnostic script={script_url} swap_matches={len(matches)}")
                for snippet in matches:
                    print(snippet)
            raise CollectorError("対象通貨ペアのスワップポイントを抽出できませんでした")
        except Exception as exc:
            error = {"broker": self.broker, "source_url": self.source_url, "message": f"{type(exc).__name__}: {exc}"}
            return [self.error_row(captured_at, error["message"])], [error]

    def parse(self, html: str, captured_at: str) -> list[dict]:
        return self.parse_generic_tables(html, captured_at)
