import argparse
import csv
import json
import re
import sys


AMOUNT = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]{0,2})?|\.[0-9]{1,2})\Z")


def main():
    parser = argparse.ArgumentParser(description="Sum CSV amounts by customer.")
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
        header = next(reader, None)
        if header is None or any(
            header.count(key) != 1 for key in ("customer", "amount")
        ):
            raise ValueError(
                "CSV header must contain exactly one customer and one amount column"
            )
        customer_index = header.index("customer")
        amount_index = header.index("amount")
        for row in reader:
            if len(row) != len(header):
                raise ValueError(
                    "CSV record ending on line {} has the wrong column count".format(
                        reader.line_num
                    )
                )
            customer = row[customer_index]
            amount = row[amount_index]
            if not customer or not AMOUNT.fullmatch(amount):
                raise ValueError(
                    "Invalid customer or amount on line {}".format(reader.line_num)
                )
            unsigned = amount.lstrip("+-")
            whole, _, fraction = unsigned.partition(".")
            cents = int(whole or "0") * 100 + int(fraction.ljust(2, "0"))
            if amount.startswith("-"):
                cents = -cents
            totals[customer] = totals.get(customer, 0) + cents

    result = []
    for customer, cents in sorted(totals.items()):
        whole, fraction = divmod(abs(cents), 100)
        amount = "{}{}.{:02d}".format("-" if cents < 0 else "", whole, fraction)
        result.append({"customer": customer, "amount": amount})
    with open(args.output, "w", encoding="utf-8", newline="\n") as destination:
        json.dump({"totals": result}, destination, ensure_ascii=False)
        destination.write("\n")


if __name__ == "__main__":
    main()
