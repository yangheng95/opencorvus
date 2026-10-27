from decimal import Decimal, ROUND_HALF_UP, localcontext


def sum_due(rows):
    """Sum decimal line amounts exactly, then round the total to cents."""
    amounts = [(Decimal(quantity), Decimal(price)) for quantity, price in rows]
    if not amounts:
        return "0.00"

    # Bound product digits, align fractional places, and allow carry from summing.
    lowest_exponent = min(-2, *(price.as_tuple().exponent for _, price in amounts))
    highest_position = max(
        len(quantity.as_tuple().digits)
        + len(price.as_tuple().digits)
        + price.as_tuple().exponent
        for quantity, price in amounts
    )
    with localcontext() as context:
        context.prec = max(
            1, highest_position - lowest_exponent + len(str(len(amounts))) + 1
        )
        total = sum((quantity * price for quantity, price in amounts), Decimal(0))
        return format(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ".2f")
