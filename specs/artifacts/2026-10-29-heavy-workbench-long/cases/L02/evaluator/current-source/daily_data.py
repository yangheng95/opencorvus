"""Read only original daily packet CSVs; no full archive, labels or score scales."""
from fractions import Fraction
from asof_input import InputError, project
from decode_materials import read_fact_tables, validate_catalogue, validate_units, utc
from material_contract import read_json


def read_packet(root):
    meta=read_json(root/'packet.json')
    if type(meta) is not dict or set(meta)!={'format','clock','origin_tick','target_ticks','series_catalogue','hierarchy','units','variables','quantiles'} or meta['format']!='l02-daily-worker-packet/1':raise InputError('packet_metadata')
    clock=meta['clock']
    if type(clock) is not dict or set(clock)!={'epoch_utc','tick_unit','event_interval'} or clock['tick_unit']!='hour' or any(type(v) is not str for v in clock.values()):raise InputError('packet_clock')
    utc(clock['epoch_utc']);validate_catalogue(meta['series_catalogue'],meta['hierarchy']);validate_units(meta['units'])
    origin=meta['origin_tick'];targets=meta['target_ticks']
    if type(origin) is not int or not 0<=origin<=10**6 or type(targets) is not list or not 1<=len(targets)<=32 or any(type(t) is not int or not origin<t<=10**6 for t in targets):raise InputError('packet_grid')
    if targets[0]!=(origin//24+2)*24 or any(b-a!=24 for a,b in zip(targets,targets[1:])):raise InputError('packet_grid')
    qs=meta['quantiles']
    if type(qs) is not list or not qs or any(type(q) is not str for q in qs):raise InputError('packet_quantiles')
    try:
        probabilities=[Fraction(q) for q in qs]
        if probabilities!=sorted(set(probabilities)) or not all(0<q<1 for q in probabilities):raise ValueError()
    except (ValueError,ZeroDivisionError) as e:raise InputError('packet_quantiles') from e
    raw=read_fact_tables(root,clock,meta['units'],meta['series_catalogue'],meta['variables'])
    projected=project(raw,origin,len(targets))
    # Authorization itself is still the single project primitive. Full coverage is checked externally against full raw.
    for table in ['observations','covariates']:
        if len(raw[table])!=len(projected[table]):raise InputError('packet_authorization')
    return raw,meta
