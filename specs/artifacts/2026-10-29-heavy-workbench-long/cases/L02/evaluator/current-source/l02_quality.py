"""Fixed-reference quality and a declared synthetic single-period decision loss.

The caller supplies authoritative contexts/labels and an independently registered
reference. This primitive is not an arbitrary-JSON candidate submission grader.
"""
from fractions import Fraction
from l02_scoring import ProtocolError, aggregate_study_metrics, number, score, validate_context
from material_contract import read_json, same_json_value
from l02_execution import archived_json, read_archive
from asof_input import validate as validate_vintages


def load_quality_policy(path):
    value = read_json(path)
    supported = {
        'format': 'l02-quality-policy/1',
        'reference_id': 'seasonal-weekday-8-365-calibration-56-84-112/1',
        'reference_role': 'fixed_external_not_candidate_baseline',
        'point_metric': 'scaled_mse', 'interval_metric': 'scaled_wis',
        'node_rule': 'every_node_mean_loss_at_most_fixed_reference',
        'macro_rule': 'both_original_layer_weighted_mean_losses_strictly_below_fixed_reference',
        'origins': 'all_registered_outer_origins_fixed_denominator',
        'study_complete_separate': True}
    if type(value) is not dict or any(value.get(k) != v or type(value.get(k)) is not type(v) for k, v in supported.items()):
        raise ProtocolError('facility_quality_policy_invalid', 'explicit supported metric/reference policy required')
    decision = value.get('decision')
    expected = {'format': 'l02-single-period-loss/1', 'unit': 'L', 'quantity': 'continuous',
        'overage_cost': 1, 'underage_cost_to_quantile': {'1': '0.5', '3': '0.75', '9': '0.9'},
        'quality_rule': 'every_leaf_and_registered_cost_case_mean_loss_at_most_fixed_reference'}
    if type(decision) is not dict or decision != expected or type(decision.get('overage_cost')) is not int:
        raise ProtocolError('facility_quality_policy_invalid', 'registered finite decision scenarios required')
    return value


def single_period_loss(action, truth, underage, overage):
    if any(type(v) not in (int, Fraction) for v in (action, truth, underage, overage)):
        raise ProtocolError('facility_decision_values_invalid', 'exact rational quantities/costs required')
    action, truth, underage, overage = map(Fraction, (action, truth, underage, overage))
    if min(action, truth) < 0 or min(underage, overage) <= 0:
        raise ProtocolError('facility_decision_values_invalid', 'nonnegative quantities and positive costs required')
    shortage = max(truth - action, Fraction())
    surplus = max(action - truth, Fraction())
    return {'shortage_litres': str(shortage), 'surplus_litres': str(surplus),
            'shortage_loss': str(underage * shortage), 'surplus_loss': str(overage * surplus),
            'loss': str(underage * shortage + overage * surplus)}


def _vintage_identity(raw):
    validate_vintages(raw)
    return {**raw,
        'observations': sorted(raw['observations'], key=lambda r: (r['series_id'], r['event_tick'], r['revision_id'])),
        'covariates': sorted(raw['covariates'], key=lambda r: (r['variable_id'], r['valid_tick'], r['revision_id']))}


def _grid_identity(grid):
    result = dict(grid)
    for field, keys in [('series_catalogue', ('series_id',)), ('hierarchy', ('parent', 'child')), ('origins', ('origin_id',))]:
        rows = grid[field]
        identities = [tuple(row[k] for k in keys) for row in rows]
        if len(set(identities)) != len(identities):
            raise ProtocolError('facility_quality_binding_invalid', 'duplicate registered grid identity')
        result[field] = sorted(rows, key=lambda row: tuple(row[k] for k in keys))
    return result


def load_registered_reference(path, data, study, policy, expected_method):
    """Read an evaluator-assigned, independently audited original-object registry.

    The calling grader must keep this path outside candidate-controlled storage.
    Schema validation does not authenticate the truth of historical provenance.
    """
    files = read_archive(path)
    try:
        if not same_json_value(_vintage_identity(archived_json(files, 'facts/canonical.json')), _vintage_identity(data.raw)) or not same_json_value(_grid_identity(archived_json(files, 'facts/grid.json')), _grid_identity(data.grid)):
            raise ProtocolError('facility_quality_binding_invalid', 'reference registered for different business facts or grid')
        pairs = [('facts/scales.json', data.scales), ('material-contract.json', data.contract),
                 ('study-contract.draft.json', study), ('policy-before-results.json', policy),
                 ('fixed-reference-method.json', expected_method)]
        if any(not same_json_value(archived_json(files, name, True), expected) for name, expected in pairs):
            raise ProtocolError('facility_quality_binding_invalid', 'reference registered for different facts, grid, units, scales, metric or policy')
        source_files = {name for name in files if name.startswith('executed-fixed-reference-source/')}
        if not source_files:
            raise ProtocolError('facility_quality_reference_invalid', 'original independently audited executed-source objects required')
        expected_origins = [g['origin_id'] for g in data.grid['origins'] if g['role'] == 'outer']
        actual = {name.split('/')[1] for name in files if name.startswith('reference/')}
        if actual != set(expected_origins):
            raise ProtocolError('facility_quality_reference_invalid', 'complete original fixed-reference matrix required')
        contexts, labels, reference = {}, {}, {}
        for origin in expected_origins:
            prefix = 'reference/' + origin + '/'
            method = archived_json(files, prefix + 'method.json', True)
            if method != {k: expected_method[k] for k in ('method_id', 'configuration')}:
                raise ProtocolError('facility_quality_reference_invalid', 'original program configuration contradicts assigned reference')
            terminal = archived_json(files, prefix + 'terminal-inspect.json')
            if terminal['State']['Status'] != 'exited' or type(terminal['State']['ExitCode']) is not int or terminal['State']['ExitCode'] != 0:
                raise ProtocolError('facility_quality_reference_invalid', 'successful original native execution required')
            contexts[origin], labels[origin], _ = data.context_and_labels(origin)
            forecast = archived_json(files, prefix + 'forecast.json', True)
            try:
                score(forecast, contexts[origin], labels[origin], expected_method['method_id'], study)
            except ProtocolError as e:
                raise ProtocolError('facility_quality_reference_invalid', 'invalid registered forecast: ' + e.code) from e
            reference[origin] = {'method_id': expected_method['method_id'], 'forecast': forecast}
        return reference, contexts, labels, expected_origins
    except (KeyError, TypeError, ValueError) as e:
        if isinstance(e, ProtocolError):
            raise
        raise ProtocolError('facility_quality_reference_invalid', str(e)) from e


def decision_metrics(forecast, context, labels, study, policy):
    """Call only after score() has verified the complete forecast schema/grid."""
    _, truth = validate_context(context, labels)
    rows = {(row['series_id'], row['target_tick']): row for row in forecast['forecasts']}
    result, actions = {}, []
    decision = policy['decision']
    for node in context['series_catalogue']:
        if node['kind'] != 'leaf':
            continue
        name = node['series_id']
        result[name] = {}
        for cost, quantile in decision['underage_cost_to_quantile'].items():
            underage, overage = int(cost), decision['overage_cost']
            if Fraction(quantile) != Fraction(underage, underage + overage):
                raise ProtocolError('facility_quality_policy_invalid', 'cost ratio and quantile directive contradict')
            values, means = [], []
            for target in context['target_ticks']:
                row = rows[name, target]
                action = number(row['quantiles'][quantile], study)
                value = single_period_loss(action, truth[name, target], underage, overage)
                means.append(single_period_loss(number(row['mean'], study), truth[name, target], underage, overage))
                values.append(value)
                actions.append({'series_id': name, 'target_tick': target, 'underage_cost': underage,
                    'overage_cost': overage, 'quantile': quantile, 'action_litres': str(action), **value})
            fields = ('shortage_litres', 'surplus_litres', 'shortage_loss', 'surplus_loss', 'loss')
            result[name][cost] = {key: str(sum(Fraction(row[key]) for row in values) / len(context['target_ticks'])) for key in fields}
            result[name][cost]['mean_action_loss'] = str(sum(Fraction(row['loss']) for row in means) / len(context['target_ticks']))
    return {'node_mean': result, 'actions': actions,
            'scope': 'declared independent single-period continuous-L loss; no capacity, inventory or joint-tail certification'}


def assess_quality(cases, reference, contexts, labels, expected_origins, study, policy):
    """Cases/reference: origin -> {method_id, forecast}; contexts are evaluator facts."""
    expected = set(expected_origins)
    if not expected or len(expected) != len(expected_origins) or set(contexts) != expected or set(labels) != expected or set(reference) != expected:
        raise ProtocolError('facility_quality_registration_invalid', 'complete authoritative grid and registered reference required')
    for origin in expected_origins:
        validate_context(contexts[origin], labels[origin])
    first = contexts[expected_origins[0]]['series_catalogue']
    nodes = {node['series_id']: node['kind'] for node in first}
    losses, choices, scored, decisions = {}, {}, {}, {}
    for origin in expected_origins:
        context = contexts[origin]
        if {n['series_id']: n['kind'] for n in context['series_catalogue']} != nodes:
            raise ProtocolError('facility_quality_registration_invalid', 'registered nodes must agree across origins')
        item = reference[origin]
        if type(item) is not dict or set(item) != {'method_id', 'forecast'}:
            raise ProtocolError('facility_quality_registration_invalid', 'bound reference method/forecast required')
        try:
            value = score(item['forecast'], context, labels[origin], item['method_id'], study)
        except ProtocolError as e:
            if not e.code.startswith('facility_'):
                raise ProtocolError('facility_quality_reference_invalid', 'registered reference forecast contradicts its assigned contract: ' + e.code) from e
            raise
        scored[origin, 'reference'] = value
        losses[origin, 'reference'] = value['metrics_exact']
        decisions[origin, 'reference'] = decision_metrics(item['forecast'], context, labels[origin], study, policy)
    if set(cases) != expected:
        raise ProtocolError('quality_incomplete', 'every registered outer contributes to the fixed denominator')
    for origin in expected_origins:
        item = cases[origin]
        if type(item) is not dict or set(item) != {'method_id', 'forecast'}:
            raise ProtocolError('quality_incomplete', 'bound candidate method/forecast required')
        choices[origin] = 'candidate'
        value = score(item['forecast'], contexts[origin], labels[origin], item['method_id'], study)
        scored[origin, 'candidate'] = value
        losses[origin, 'candidate'] = value['metrics_exact']
        decisions[origin, 'candidate'] = decision_metrics(item['forecast'], contexts[origin], labels[origin], study, policy)
    aggregate = aggregate_study_metrics(losses, choices, ['candidate', 'reference'])['per_method']
    leaves = []
    def add(identifier, candidate, baseline, strict=False):
        candidate, baseline = Fraction(candidate), Fraction(baseline)
        leaves.append({'id': identifier, 'critical': True, 'candidate_loss': str(candidate),
            'reference_loss': str(baseline), 'comparison': '<' if strict else '<=',
            'passed': candidate < baseline if strict else candidate <= baseline})
    for metric in ('scaled_mse', 'scaled_wis'):
        add('macro.' + metric, aggregate['candidate'][metric], aggregate['reference'][metric], strict=True)
    node_means, operating_means = {}, {}
    for node, kind in nodes.items():
        node_means[node] = {}
        for metric in ('scaled_mse', 'scaled_wis'):
            values = {role: sum(Fraction(scored[origin, role]['node_metrics_exact'][node][metric]) for origin in expected_origins) / len(expected_origins) for role in ('candidate', 'reference')}
            node_means[node][metric] = {role: str(v) for role, v in values.items()}
            add('node.' + node + '.' + metric, values['candidate'], values['reference'])
        if kind != 'leaf':
            continue
        operating_means[node] = {}
        for cost in policy['decision']['underage_cost_to_quantile']:
            values = {role: sum(Fraction(decisions[origin, role]['node_mean'][node][cost]['loss']) for origin in expected_origins) / len(expected_origins) for role in ('candidate', 'reference')}
            operating_means[node][cost] = {role: str(v) for role, v in values.items()}
            add('decision.' + node + '.underage_' + cost, values['candidate'], values['reference'])
    return {'status': 'quality_assessed', 'reference_id': policy['reference_id'], 'origin_ids': expected_origins,
        'quality_success': all(row['passed'] for row in leaves), 'leaves': leaves,
        'macro_losses': aggregate, 'node_losses': node_means, 'decision_losses': operating_means,
        'per_origin_decisions': {origin: {role: decisions[origin, role] for role in ('candidate', 'reference')} for origin in expected_origins},
        'study_complete': None, 'candidate_score': None,
        'scope': 'registered numerical acceptance policy only; not a full case grade, scientific review, significance or maturity claim'}
