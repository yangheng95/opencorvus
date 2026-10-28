import csv
from pathlib import Path


def read_orders(path):
    with Path(path).open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))
