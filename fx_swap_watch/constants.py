"""Shared constants for FX swap collection."""

from __future__ import annotations

from collections import OrderedDict

TARGET_PAIRS: "OrderedDict[str, tuple[str, ...]]" = OrderedDict(
    {
        "USDJPY": ("USD/JPY", "米ドル/円", "米ドル円", "USDJPY"),
        "EURJPY": ("EUR/JPY", "ユーロ/円", "ユーロ円", "EURJPY"),
        "GBPJPY": ("GBP/JPY", "ポンド/円", "英ポンド/円", "ポンド円", "GBPJPY"),
        "AUDJPY": ("AUD/JPY", "豪ドル/円", "豪ドル円", "AUDJPY"),
        "NZDJPY": ("NZD/JPY", "NZドル/円", "ニュージーランドドル/円", "NZドル円", "NZDJPY"),
        "TRYJPY": ("TRY/JPY", "トルコリラ/円", "トルコリラ円", "TRYJPY"),
        "MXNJPY": ("MXN/JPY", "メキシコペソ/円", "メキシコペソ円", "MXNJPY"),
        "ZARJPY": ("ZAR/JPY", "南アフリカランド/円", "南アランド/円", "ランド/円", "ZARJPY"),
        "HUFJPY": ("HUF/JPY", "ハンガリーフォリント/円", "フォリント/円", "HUFJPY"),
    }
)

SCHEMA_COLUMNS = [
    "captured_at",
    "value_date",
    "broker",
    "pair",
    "side",
    "swap_points",
    "days",
    "unit",
    "source_url",
    "raw_value",
    "normalized_swap_per_10k",
    "normalized_swap_per_10k_per_day",
    "error",
]

HIGH_UNIT_PAIRS = {"MXNJPY", "ZARJPY", "HUFJPY"}
DEFAULT_UNIT = 10_000
HIGH_UNIT = 100_000
