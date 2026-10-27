def sum_due(rows):
    return str(sum(quantity * float(unit_price) for quantity, unit_price in rows))
