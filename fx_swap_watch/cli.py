"""Command line interface for the collector."""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone
from pathlib import Path

from .collectors import COLLECTORS
from .storage import ensure_data_files, write_outputs

USER_AGENT = "fx-swap-watch/0.1 (+https://github.com/ProtChan/kawaii-lab-stats)"


def collect(data_dir: Path, sleep_seconds: float = 1.0) -> int:
    captured_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        import requests
    except ModuleNotFoundError as exc:
        raise SystemExit("requests is required for collect; install requirements-fx-swap.txt") from exc
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    all_rows: list[dict] = []
    all_errors: list[dict[str, str]] = []
    for index, collector in enumerate(COLLECTORS):
        if index:
            time.sleep(sleep_seconds)
        rows, errors = collector.collect(session, captured_at)
        all_rows.extend(rows)
        all_errors.extend(errors)
    paths = write_outputs(all_rows, all_errors, data_dir, captured_at)
    print(f"captured_at={captured_at}")
    print(f"rows={len(all_rows)} errors={len(all_errors)}")
    for name, path in paths.items():
        print(f"{name}={path}")
    return 0


def init(data_dir: Path) -> int:
    ensure_data_files(data_dir)
    latest = data_dir / "latest.json"
    if not latest.exists():
        latest.write_text(
            '{\n  "captured_at": null,\n  "row_count": 0,\n  "errors": [],\n  "data": [],\n  "downloads": {"history_csv": "../data/history.csv", "daily_csv": null}\n}\n',
            encoding="utf-8",
        )
    print(f"initialized {data_dir}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect and store FX swap points")
    parser.add_argument("command", choices=("collect", "init"))
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--sleep-seconds", default=1.0, type=float)
    args = parser.parse_args()
    if args.command == "collect":
        return collect(args.data_dir, args.sleep_seconds)
    return init(args.data_dir)


if __name__ == "__main__":
    raise SystemExit(main())
