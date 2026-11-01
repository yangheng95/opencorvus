import csv
import json
from pathlib import Path
import sys

project = Path(sys.argv[1]).resolve()
download = Path(sys.argv[2]).resolve()
with (project / 'orders.csv').open(encoding='utf-8-sig', newline='') as stream:
    orders = list(csv.DictReader(stream))
counts = {
    'orders_total': len(orders),
    'included_orders': sum(row['status'].strip() in {'paid', 'refunded'} for row in orders),
    'excluded_orders': sum(row['status'].strip() == 'cancelled' for row in orders),
}
assert counts == {'orders_total': 10, 'included_orders': 9, 'excluded_orders': 1}
results = [
    {'team': 'North', 'currency': 'CNY', 'net_amount': '25.29'},
    {'team': 'North', 'currency': 'USD', 'net_amount': '-1.25'},
    {'team': 'South', 'currency': 'CNY', 'net_amount': '44.00'},
    {'team': 'South', 'currency': 'USD', 'net_amount': '0.30'},
]
expected = {'results': results, **counts, 'report': 'REPORT.md'}
receipt = json.loads((project / 'receipt.json').read_text(encoding='utf-8'))
assert receipt == expected
assert all(type(receipt[key]) is int for key in counts)
assert all(type(value) is str for row in receipt['results'] for value in row.values())
assert json.loads((project / 'delivery.json').read_text(encoding='utf-8')) == {'results': results, 'report': 'REPORT.md'}
assert download.read_bytes() == (project / 'receipt.json').read_bytes()
print(json.dumps({'ok': True, 'receipt': receipt, 'download_bytes': download.stat().st_size, 'download_bytes_equal': True}))
