"""Flatten a UTF-8 JSON file into an RFC 6901 pointer-to-leaf object."""

import argparse
from decimal import Decimal
import json
import sys


def flatten(value):
    """Return leaf values indexed by JSON Pointer, including empty containers."""
    result = {}
    pending = [("", value)]
    while pending:
        pointer, item = pending.pop()
        if isinstance(item, dict) and item:
            children = [
                (pointer + "/" + key.replace("~", "~0").replace("/", "~1"), child)
                for key, child in item.items()
            ]
            pending.extend(reversed(children))
        elif isinstance(item, list) and item:
            pending.extend(
                (pointer + "/" + str(index), item[index])
                for index in range(len(item) - 1, -1, -1)
            )
        else:
            result[pointer] = item
    return result


def reject_constant(token):
    raise ValueError("not a JSON number: " + token)


def write_mapping(mapping, stream):
    """Emit JSON without rounding decimal input numbers through binary floats.

    Escaped strings also safely preserve JSON strings containing lone surrogate
    escapes; the resulting file is valid UTF-8 even for those inputs.
    """
    stream.write("{")
    for index, (pointer, value) in enumerate(mapping.items()):
        if index:
            stream.write(",")
        stream.write(json.dumps(pointer, ensure_ascii=True))
        stream.write(":")
        if isinstance(value, Decimal):
            stream.write(str(value))
        else:
            stream.write(json.dumps(value, ensure_ascii=True, allow_nan=False))
    stream.write("}\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", metavar="INPUT", help="UTF-8 JSON input file")
    parser.add_argument(
        "--output", required=True, metavar="OUTPUT", help="UTF-8 JSON output file"
    )
    args = parser.parse_args(argv)
    # Python 3.11+ otherwise rejects valid JSON integers over 4,300 digits.
    if hasattr(sys, "set_int_max_str_digits"):
        sys.set_int_max_str_digits(0)
    try:
        with open(args.input, encoding="utf-8") as stream:
            value = json.load(
                stream, parse_float=Decimal, parse_constant=reject_constant
            )
        mapping = flatten(value)
        with open(args.output, "w", encoding="utf-8", newline="\n") as stream:
            write_mapping(mapping, stream)
    except (OSError, UnicodeError, ValueError, RecursionError) as error:
        parser.exit(1, "error: {}\n".format(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
