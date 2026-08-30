"""Row construction and normalization helpers."""

from __future__ import annotations

from datetime import date
from typing import Any

from .constants import DEFAULT_UNIT, HIGH_UNIT, HIGH_UNIT_PAIRS, SCHEMA_COLUMNS


def default_unit(pair: str) -> int:
    return HIGH_UNIT if pair in HIGH_UNIT_PAIRS else DEFAULT_UNIT


def normalize_swap(swap_points: float | None, days: int, unit: int) -> tuple[float | None, float | None]:
    if swap_points is None:
        return None, None
    normalized = swap_points * (10_000 / unit)
    per_day = normalized / max(days, 1)
    return round(normalized, 6), round(per_day, 6)


def make_row(
    *,
    captured_at: str,
    broker: str,
    pair: str,
    side: str,
    source_url: str,
    swap_points: float | None = None,
    raw_value: str = "",
    days: int = 1,
    unit: int | None = None,
    value_date: str | None = None,
    error: str = "",
) -> dict[str, Any]:
    resolved_unit = unit or default_unit(pair)
    normalized, per_day = normalize_swap(swap_points, days, resolved_unit)
    row = {
        "captured_at": captured_at,
        "value_date": value_date or date.today().isoformat(),
        "broker": broker,
        "pair": pair,
        "side": side,
        "swap_points": swap_points,
        "days": days,
        "unit": resolved_unit,
        "source_url": source_url,
        "raw_value": raw_value,
        "normalized_swap_per_10k": normalized,
        "normalized_swap_per_10k_per_day": per_day,
        "error": error,
    }
    return {column: row.get(column, "") for column in SCHEMA_COLUMNS}
