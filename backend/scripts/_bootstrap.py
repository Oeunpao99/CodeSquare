"""Path shim for the standalone scripts in this folder.

The seed / maintenance scripts do plain ``from database import ...`` /
``from models.models import ...`` — imports that only resolve when ``backend/``
is on ``sys.path``. When a script is launched as ``python scripts/seed_x.py``
Python puts *this* folder on ``sys.path[0]`` instead, so those imports break.

Every script here imports this module first (``import _bootstrap``) to prepend
``backend/`` back onto ``sys.path``. Sibling scripts (``from backfill_exercises
import ...``) keep working because this folder is already ``sys.path[0]``.
"""
import pathlib
import sys

_BACKEND = str(pathlib.Path(__file__).resolve().parent.parent)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)
