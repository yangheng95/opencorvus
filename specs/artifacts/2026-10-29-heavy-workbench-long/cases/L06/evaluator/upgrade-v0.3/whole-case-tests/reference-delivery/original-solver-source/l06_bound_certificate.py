"""Exact row-dual lower bound on an integer linear model's finite variable box.

For <= rows use y<=0, for equality rows y is free. Put r=c-A^T y.
Every feasible x in [l,u] has c^T x >= b^T y + sum(min(r_i*l_i,r_i*u_i)).
The residual correction makes this valid without floating point stationarity.
"""
from fractions import Fraction


def evaluate_certificate(model,certificate):
    if model['format']!='l06-linear-relaxation/1' or certificate['format']!='l06-row-dual-certificate/1':
        raise ValueError('certificate_format')
    lower=model['variable_lower'];upper=model['variable_upper'];denominator=model['objective_denominator']
    numerators=model['objective_numerators']
    if not (len(lower)==len(upper)==len(numerators)):
        raise ValueError('certificate_dimension')
    if any(type(v) is not int for v in [denominator,*lower,*upper,*numerators]) or denominator<=0:
        raise ValueError('certificate_integer_model')
    residual=[Fraction(n,denominator) for n in numerators]
    if any(lo>hi for lo,hi in zip(lower,upper)):raise ValueError('certificate_box')
    constant=Fraction(0);seen=set()
    for entry in certificate['multipliers']:
        if type(entry['row']) is not int or not 0<=entry['row']<len(model['rows']):
            raise ValueError('certificate_row_index')
        identity=(entry['row'],entry['side'])
        if identity in seen:raise ValueError('certificate_duplicate_row')
        seen.add(identity)
        row=model['rows'][entry['row']];side=entry['side'];value=Fraction(entry['value'])
        if side=='equality':
            if row['lower'] is None or row['lower']!=row['upper']:raise ValueError('certificate_equality')
            rhs=row['upper'];sign=1
        elif side in ('upper','lower'):
            if value>0:raise ValueError('certificate_dual_cone')
            rhs=row[side];sign=1 if side=='upper' else -1
            if rhs is None:raise ValueError('certificate_infinite_row')
        else:raise ValueError('certificate_row_side')
        if type(rhs) is not int:raise ValueError('certificate_integer_rhs')
        constant+=sign*rhs*value
        for index,coefficient in row['terms']:
            if type(index) is not int or type(coefficient) is not int or not 0<=index<len(residual):
                raise ValueError('certificate_integer_coefficient')
            residual[index]-=sign*coefficient*value
    correction=sum((min(r*lo,r*hi) for r,lo,hi in zip(residual,lower,upper)),Fraction(0))
    bound=constant+correction
    return {'scope':'exact rational linear-model bound; model/business inclusion reviewed separately',
            'lower_bound_exact':str(bound),'lower_bound':float(bound),'row_dual_constant_exact':str(constant),
            'box_correction_exact':str(correction),'maximum_stationarity_residual_exact':str(max(map(abs,residual),default=Fraction(0))),
            'multipliers_evaluated':len(seen),'variables':len(residual),'arithmetic':'fractions.Fraction; no floating acceptance tolerance'}
