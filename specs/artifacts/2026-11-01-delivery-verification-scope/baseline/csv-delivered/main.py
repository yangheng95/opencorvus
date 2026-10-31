import argparse
import csv
import json
import re
import sys


def main():
    parser = argparse.ArgumentParser(
        description="Sum CSV amounts by exact customer name."
    )
    parser.add_argument("input")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    if hasattr(sys, "set_int_max_str_digits"):
        sys.set_int_max_str_digits(0)
    field_limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(field_limit)
            break
        except OverflowError:
            field_limit //= 10

    totals = {}
    with open(args.input, encoding="utf-8", newline="") as source:
        reader = csv.reader(source, strict=True)
        header = next(reader, [])
        if "customer" not in header or "amount" not in header:
            parser.error("input header must contain customer and amount columns")
        customer_index = header.index("customer")
        amount_index = header.index("amount")
        for row in reader:
            if len(row) != len(header):
                parser.error(
                    f"CSV record ending at line {reader.line_num} has the wrong number of fields"
                )
            customer = row[customer_index]
            amount = row[amount_index]
            if not customer:
                parser.error(f"empty customer at line {reader.line_num}")
            if not re.fullmatch(
                r"[+-]?(?:[0-9]+(?:\.[0-9]{0,2})?|\.[0-9]{1,2})", amount
            ):
                parser.error(f"invalid amount at line {reader.line_num}: {amount!r}")
            whole, _, fraction = amount.lstrip("+-").partition(".")
            cents = int(whole or "0") * 100 + int(fraction.ljust(2, "0"))
            if amount.startswith("-"):
                cents = -cents
            totals[customer] = totals.get(customer, 0) + cents

    records = []
    for customer, cents in sorted(totals.items()):
        whole, fraction = divmod(abs(cents), 100)
        amount = f"{'-' if cents < 0 else ''}{whole}.{fraction:02d}"
        records.append({"customer": customer, "amount": amount})
    with open(args.output, "w", encoding="utf-8", newline="\n") as destination:
        json.dump({"totals": records}, destination, ensure_ascii=False)
        destination.write("\n")


if __name__ == "__main__":
    main()
