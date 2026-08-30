"""Collector registry."""

from .gaitame import GaitameCollector
from .gmo_click import GmoClickCollector
from .lightfx import LightFxCollector
from .minfx import MinFxCollector

COLLECTORS = [
    GaitameCollector(),
    MinFxCollector(),
    LightFxCollector(),
    GmoClickCollector(),
]

__all__ = ["COLLECTORS", "GaitameCollector", "GmoClickCollector", "LightFxCollector", "MinFxCollector"]
