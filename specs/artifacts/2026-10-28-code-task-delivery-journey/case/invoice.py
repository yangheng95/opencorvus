from decimal import Context, Decimal, MAX_EMAX, MIN_EMIN, ROUND_HALF_UP, localcontext


def sum_due(rows):
    amounts = [
        (Decimal(quantity), Decimal(unit_price)) for quantity, unit_price in rows
    ]
    lowest_place = min([-2] + [price.as_tuple().exponent for _, price in amounts])
    highest_place = max(
        [0]
        + [quantity.adjusted() + price.adjusted() + 2 for quantity, price in amounts]
    )
    # Reserve every input place, product carry, and the carry from summing all rows.
    precision = highest_place - lowest_place + len(str(len(amounts))) + 2
    context = Context(
        prec=precision, rounding=ROUND_HALF_UP, Emax=MAX_EMAX, Emin=MIN_EMIN
    )
    with localcontext(context):
        total = sum((quantity * price for quantity, price in amounts), Decimal(0))
        return format(total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ".2f")
