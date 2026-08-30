"""CSV/JSON persistence helpers."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .constants import SCHEMA_COLUMNS


def ensure_data_files(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "daily").mkdir(parents=True, exist_ok=True)
    history = data_dir / "history.csv"
    if not history.exists():
        _write_csv(history, [])


def write_outputs(rows: list[dict[str, Any]], errors: list[dict[str, str]], data_dir: Path, captured_at: str) -> dict[str, Path]:
    ensure_data_files(data_dir)
    date_part = captured_at[:10]
    daily_path = data_dir / "daily" / f"{date_part}.csv"
    history_path = data_dir / "history.csv"
    latest_path = data_dir / "latest.json"

    rows = [_standardize(row) for row in rows]
    _write_csv(daily_path, rows)
    _append_csv(history_path, rows)

    payload = {
        "captured_at": captured_at,
        "row_count": len(rows),
        "errors": errors,
        "data": rows,
        "downloads": {
            "history_csv": "../data/history.csv",
            "daily_csv": f"../data/daily/{date_part}.csv",
        },
    }
    latest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    return {"daily": daily_path, "history": history_path, "latest": latest_path}


def _standardize(row: dict[str, Any]) -> dict[str, Any]:
    return {column: row.get(column, "") for column in SCHEMA_COLUMNS}


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=SCHEMA_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def _append_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not path.exists() or path.stat().st_size == 0:
        _write_csv(path, rows)
        return
    with path.open("a", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=SCHEMA_COLUMNS)
        writer.writerows(rows)
