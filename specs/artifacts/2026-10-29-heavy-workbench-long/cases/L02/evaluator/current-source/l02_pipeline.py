"""One numerical assembly and captured-input contract for execution and audit."""
from pathlib import Path
import tempfile

from asof_input import InputError
from l02_execution import ExecutionError, archived_json, json_bytes, regular_bytes, candidate_json, candidate_text
from l02_scoring import ProtocolError, aggregate_study_metrics, score
from l02_selection import assess_selection
from material_contract import same_json_value


def candidate_assessment(check):
    """Map the scoring library's declared protocol errors at the output boundary."""
    try:
        return check()
    except ProtocolError as e:
        raise ExecutionError(e.code, e.detail, candidate=not e.code.startswith('facility_')) from e


def forecast_inputs(data, origin_id, method):
    with tempfile.TemporaryDirectory(prefix='l02-authorized-packet-') as tmp:
        packet = Path(tmp) / 'packet'
        data.packet(origin_id, packet)
        inputs = {'packet/' + n: v for n, v in regular_bytes(packet).items()}
    inputs['method.json'] = json_bytes({k: method[k] for k in ('method_id', 'configuration')})
    return inputs


def verify_forecast_inputs(files, data, origin_id, method):
    expected = {k: method[k] for k in ('method_id', 'configuration')}
    try:
        if not same_json_value(archived_json(files, 'input/method.json', True), expected):
            raise ExecutionError('facility_method_binding_invalid', origin_id)
        packet = {n[13:]: v for n, v in files.items() if n.startswith('input/packet/')}
        if set(packet) != {'packet.json', 'observations.csv', 'covariate-vintages.csv'} or {n for n in files if n.startswith('input/')} != {'input/method.json', *('input/packet/' + n for n in packet)}:
            raise ExecutionError('facility_forecast_packet_invalid', 'exact authorized packet files required')
        with tempfile.TemporaryDirectory(prefix='l02-captured-packet-') as tmp:
            root = Path(tmp)
            for name, value in packet.items():
                (root / name).write_bytes(value)
            receipt = data.verify_packet(origin_id, root)
    except (InputError, KeyError, ValueError, TypeError) as e:
        raise ExecutionError('facility_forecast_packet_invalid', str(e)) from e
    return receipt


def assess_forecast(files, data, origin_id, method, study):
    receipt = verify_forecast_inputs(files, data, origin_id, method)
    context, labels, _ = data.context_and_labels(origin_id)
    return {'metric': candidate_assessment(lambda: score(candidate_json(files, 'output/result/forecast.json', True), context, labels, method['method_id'], study)),
            'packet_verification': receipt}


def verify_selector_inputs(files, expected, study):
    try:
        if {n for n in files if n.startswith('input/')} != {'input/inner.json', 'input/study.json'} or not same_json_value(archived_json(files, 'input/inner.json', True), expected) or not same_json_value(archived_json(files, 'input/study.json', True), study):
            raise ExecutionError('facility_selection_binding_invalid', 'captured packet differs from assigned published inner facts/predictions')
    except (InputError, KeyError, ValueError, TypeError) as e:
        raise ExecutionError('facility_selection_binding_invalid', str(e)) from e


def assess_selector(files, expected, study):
    verify_selector_inputs(files, expected, study)
    return candidate_assessment(lambda: assess_selection(candidate_json(files, 'output/result/selection.json'), expected, study))


def selection_packet(data, outer_id, pool, forecast):
    outer = data.origins[outer_id]
    inner = [g for g in data.grid['origins'] if g['role'] == 'inner' and g['outer_id'] == outer_id]
    if len(inner) != len(data.contract['schedule']['inner_days_before']) or outer['origin_tick'] < data.scale_release_tick:
        raise ExecutionError('facility_inner_registration_invalid', outer_id)
    frames = []
    for origin in inner:
        context, labels, released = data.context_and_labels(origin['origin_id'])
        if released > outer['origin_tick']:
            raise ExecutionError('facility_inner_label_unpublished', origin['origin_id'])
        forecasts = {method: forecast(origin['origin_id'], method) for method in pool['selection_ids']}
        frames.append({'origin_id': origin['origin_id'], 'context': context, 'labels': labels,
                       'labels_released_at': released, 'forecasts': forecasts})
    return {'format': 'l02-inner-selection-packet/1', 'outer_origin_tick': outer['origin_tick'],
            'inner_ids': [g['origin_id'] for g in inner], 'selection_ids': pool['selection_ids'], 'frames': frames}


def assemble(data, registration, pool, methods, study, predict, select):
    """Callbacks execute or read the same assigned immutable numerical objects."""
    completed = []
    for outer_id in registration['outer_ids']:
        def prediction(origin_id, method_id, level):
            identity = {'kind': 'predict', 'outer_id': outer_id, 'origin_id': origin_id, 'method_id': method_id, 'level': level}
            files = predict(identity, methods[method_id])
            assessed = assess_forecast(files, data, origin_id, methods[method_id], study)
            if not same_json_value(assessed, archived_json(files, 'assessment.json')):
                raise ExecutionError('facility_metric_assessment_invalid', str(identity))
            return candidate_json(files, 'output/result/forecast.json', True), assessed['metric']

        payload = selection_packet(data, outer_id, pool, lambda origin, method: prediction(origin, method, 'inner')[0])
        selected = select({'kind': 'select', 'outer_id': outer_id}, payload)
        selection_assessment = assess_selector(selected, payload, study)
        if not same_json_value(selection_assessment, archived_json(selected, 'assessment.json')):
            raise ExecutionError('facility_selection_assessment_invalid', outer_id)
        selection = candidate_json(selected, 'output/result/selection.json')
        metrics, forecasts = {}, {}
        for method in pool['outer_ids']:
            forecasts[method], metrics[method] = prediction(outer_id, method, 'outer')
        context, labels, released = data.context_and_labels(outer_id)
        completed.append({'outer_id': outer_id, 'selected_method_id': selection['selected_method_id'],
            'inner_selection': selection_assessment, 'metrics': metrics, 'forecasts': forecasts,
            'context': context, 'labels': labels, 'label_release_tick': released})
    aggregate = aggregate_study_metrics(
        {(row['outer_id'], method): row['metrics'][method]['metrics_exact'] for row in completed for method in pool['outer_ids']},
        {row['outer_id']: row['selected_method_id'] for row in completed}, pool['outer_ids'])
    return {'format': 'l02-completed-numerical-results/1', 'outer_ids': registration['outer_ids'],
        'all_outer_ids': registration['all_outer_ids'], 'complete_assignment': set(registration['outer_ids']) == set(registration['all_outer_ids']),
        'pool': pool, 'aggregate_exact': aggregate, 'outer_results': completed, 'candidate_score': None,
        'quality_floor': study['quality_floor']}


def assess_report(files, outer_ids):
    receipt = candidate_json(files, 'output/result/report.json')
    report = candidate_text(files, 'output/result/report.md')
    if type(receipt) is not dict or receipt.get('format') != 'l02-report-receipt/1' or not same_json_value(receipt.get('outer_ids'), outer_ids) or not report.strip():
        raise ExecutionError('report_delivery_invalid', 'nonempty report and exact requested-origin receipt required', candidate=True)
    return {'status': 'report_protocol_verified', 'scientific_review': 'unassessed', 'candidate_score': None}
