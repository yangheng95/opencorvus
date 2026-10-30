"""Release-aware L02 numerical primitives. Only this module and declared files are imported."""
import csv
import json
import math
import re
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path

EPOCH = datetime(2022, 1, 1, tzinfo=timezone.utc)
QUANTILES = ['0.025', '0.1', '0.25', '0.5', '0.75', '0.9', '0.975']


def load(path, exact=False):
    with open(path, encoding='utf-8-sig') as f:
        return json.load(f, parse_float=Fraction) if exact else json.load(f)


def dump(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, allow_nan=False, indent=2)
        f.write('\n')


def tick(value):
    dt = datetime.strptime(value, '%Y-%m-%dT%H:00:00Z').replace(tzinfo=timezone.utc)
    return int((dt - EPOCH).total_seconds() // 3600)


def utc(t):
    return (EPOCH + timedelta(hours=t)).strftime('%Y-%m-%dT%H:00:00Z')


def day(t):
    return (EPOCH + timedelta(hours=t - 24)).date()


def day_end(d):
    return int(((datetime.combine(d + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)) - EPOCH).total_seconds() // 3600)


def F(v):
    if isinstance(v, bool):
        raise ValueError('boolean_is_not_numeric')
    return Fraction(str(v))


def csvwrite(path, rows, fields=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = list(rows)
    fields = fields or (list(rows[0]) if rows else [])
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


class Vintages:
    """All parsing remains exact until integer litres enter model linear algebra."""
    def __init__(self, root, packet):
        self.packet = packet
        self.obs = []
        self.cov = []
        self.registry = {}
        for name, dest, identity, datefield, endfield in [
            ('observations.csv', self.obs, 'series_id', 'event_date', 'event_end_utc'),
            ('covariate-vintages.csv', self.cov, 'variable_id', 'valid_date', 'valid_end_utc')]:
            seen = set()
            with (Path(root) / name).open(encoding='utf-8-sig', newline='') as f:
                for ln, row in enumerate(csv.DictReader(f), 2):
                    rev = row['revision_id']
                    if re.fullmatch(r'0|[1-9][0-9]*', rev) is None:
                        raise ValueError('invalid_revision')
                    end, release = tick(row[endfield]), tick(row['release_time_utc'])
                    if end % 24 or str(day(end)) != row[datefield]:
                        raise ValueError('invalid_daily_interval')
                    ident = row[identity]
                    key = ident, end, int(rev)
                    if key in seen:
                        raise ValueError('duplicate_revision_identity')
                    seen.add(key)
                    if row['quality_flag'] == 'missing':
                        if row['value'] != '':
                            raise ValueError('missing_value_not_empty')
                        value = None
                    elif row['quality_flag'] == 'valid':
                        if identity == 'series_id':
                            if re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', row['value']) is None:
                                raise ValueError('invalid_observation_decimal')
                            val = F(row['value']) * F(packet['units'][row['unit']]['multiplier'])
                            if val.denominator != 1:
                                raise ValueError('noninteger_litres')
                            value = val.numerator
                        else:
                            if re.fullmatch(r'0|-?[1-9][0-9]*', row['value']) is None:
                                raise ValueError('invalid_covariate_integer')
                            if row['unit'] != packet['variables'][ident]['unit']:
                                raise ValueError('invalid_covariate_unit')
                            value = int(row['value'])
                    else:
                        raise ValueError('invalid_quality_flag')
                    ref = name + ':' + str(ln)
                    r = {'id': ident, 'end': end, 'release': release, 'revision': int(rev), 'value': value, 'ref': ref}
                    dest.append(r)
                    self.registry[ref] = {'file': name, 'line': ln, **row, 'canonical_value': value}
        self.obs.sort(key=lambda r: (r['id'], r['end'], r['revision']))
        self.cov.sort(key=lambda r: (r['id'], r['end'], r['revision']))

    def snapshot(self, origin):
        obs, cov = {}, {}
        for source, dest, observational in [(self.obs, obs, True), (self.cov, cov, False)]:
            for r in source:
                if r['release'] > origin:
                    continue
                observed = observational or self.packet['variables'][r['id']]['availability'] == 'observed'
                if observed and r['end'] >= origin:
                    continue
                key = r['id'], r['end']
                if key not in dest or r['revision'] > dest[key]['revision']:
                    dest[key] = r
        return obs, cov


def score(context, labels, forecast):
    truth = {(r['series_id'], r['target_tick']): F(r['value']) for r in labels}
    rows = {(r['series_id'], r['target_tick']): r for r in forecast['forecasts']}
    nodes = context['series_catalogue']
    target = context['target_ticks']
    expected = {(n['series_id'], t) for n in nodes for t in target}
    if set(truth) != expected or set(rows) != expected or len(forecast['forecasts']) != len(expected):
        raise ValueError('incomplete_score_grid')
    per = {}
    for n in nodes:
        sid = n['series_id']
        s = F(context['scales_litres'][sid])
        if s <= 0:
            raise ValueError('invalid_scale')
        acc = {'scaled_mse': Fraction(), 'scaled_mae': Fraction(), 'scaled_wis': Fraction()}
        for t in target:
            r, y = rows[sid, t], truth[sid, t]
            q = {k: F(v) for k, v in r['quantiles'].items()}
            err = F(r['mean']) - y
            wis = F('0.5') * abs(y - q['0.5'])
            for a, lo, hi in [('0.5','0.25','0.75'), ('0.2','0.1','0.9'), ('0.05','0.025','0.975')]:
                alpha = F(a)
                interval = q[hi] - q[lo] + 2/alpha * max(q[lo]-y, 0) + 2/alpha * max(y-q[hi], 0)
                wis += alpha / 2 * interval
            acc['scaled_mse'] += (err / s)**2
            acc['scaled_mae'] += abs(err) / s
            acc['scaled_wis'] += wis / F('3.5') / s
        per[sid] = {k: str(v/len(target)) for k, v in acc.items()}
    macro = {k: str(sum(F(per[n['series_id']][k]) / sum(m['kind']==n['kind'] for m in nodes) / 2 for n in nodes)) for k in acc}
    return {'status': 'forecast_assessed', 'metrics_exact': macro, 'node_metrics_exact': per, 'rows': len(expected), 'scope': 'Layer-equal marginal research metrics; no joint path certification.', 'candidate_score': None}


def validate_forecast(packet, method, forecast):
    if set(forecast) != {'format','method_id','origin_tick','forecasts'} or forecast['format'] != 'l02-distribution-forecasts/1':
        raise ValueError('forecast_envelope')
    if forecast['method_id'] != method['method_id'] or forecast['origin_tick'] != packet['origin_tick']:
        raise ValueError('forecast_identity')
    expected = {(s['series_id'], t) for s in packet['series_catalogue'] for t in packet['target_ticks']}
    rows = {}
    for r in forecast['forecasts']:
        if set(r) != {'series_id','target_tick','mean','quantiles'} or set(r['quantiles']) != set(QUANTILES):
            raise ValueError('forecast_row_schema')
        key = r['series_id'], r['target_tick']
        if key in rows:
            raise ValueError('forecast_duplicate')
        rows[key] = r
        values = [r['mean']] + [r['quantiles'][q] for q in QUANTILES]
        if any(isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) or v<0 or v>1e12 for v in values):
            raise ValueError('forecast_domain')
        if [r['quantiles'][q] for q in QUANTILES] != sorted(r['quantiles'].values()):
            raise ValueError('forecast_quantile_order')
    if set(rows) != expected or len(rows)!=84:
        raise ValueError('forecast_grid')
    for p in sorted(set(e['parent'] for e in packet['hierarchy'])):
        for t in packet['target_ticks']:
            parent = rows[p,t]['mean']
            child = sum(float(e['weight'])*rows[e['child'],t]['mean'] for e in packet['hierarchy'] if e['parent']==p)
            if abs(parent-child)>1e-6*max(1,abs(parent),abs(child)):
                raise ValueError('forecast_coherence')
    return {'status':'forecast_contract_checked','rows':84,'origin_tick':packet['origin_tick']}
