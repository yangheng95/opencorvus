"""Flatten a UTF-8 JSON file to RFC 6901 leaf pointers (standard library only)."""

import argparse
from decimal import Decimal
import json
import sys


def flatten(value):
    """Return all scalar and empty-container leaves, including an empty root."""
    result = {}
    pending = [("", value)]
    while pending:
        pointer, item = pending.pop()
        if isinstance(item, dict) and item:
            for key, child in reversed(list(item.items())):
                token = key.replace("~", "~0").replace("/", "~1")
                pending.append((pointer + "/" + token, child))
        elif isinstance(item, list) and item:
            for index in range(len(item) - 1, -1, -1):
                pending.append((pointer + "/" + str(index), item[index]))
        else:
            result[pointer] = item
    return result


def reject_constant(value):
    raise ValueError("not a JSON number: " + value)


def write_mapping(mapping, stream):
    """Serialize leaves, retaining arbitrary-precision decimal JSON numbers."""
    stream.write("{")
    for index, (pointer, value) in enumerate(mapping.items()):
        if index:
            stream.write(",")
        stream.write("\n  " + json.dumps(pointer, ensure_ascii=True) + ": ")
        if isinstance(value, Decimal):
            stream.write(str(value))
        else:
            # ASCII escapes also preserve isolated JSON surrogate code units;
            # the resulting file is valid UTF-8 and strings decode unchanged.
            stream.write(json.dumps(value, ensure_ascii=True, allow_nan=False))
    stream.write("\n}\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="path to a UTF-8 JSON file")
    parser.add_argument(
        "--output", required=True, help="path for the flattened JSON object"
    )
    args = parser.parse_args(argv)
    # JSON imposes no digit limit on integers. Python 3.11+ has an optional one.
    if hasattr(sys, "set_int_max_str_digits"):
        sys.set_int_max_str_digits(0)
    try:
        with open(args.input, "r", encoding="utf-8") as source:
            value = json.load(
                source, parse_float=Decimal, parse_constant=reject_constant
            )
        mapping = flatten(value)
        with open(args.output, "w", encoding="utf-8", newline="\n") as output:
            write_mapping(mapping, output)
    except (OSError, UnicodeError, ValueError, RecursionError) as error:
        parser.exit(1, "error: " + str(error) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
