"""Aggregate trusted evaluator findings for L02; not a candidate self-rating API."""
from fractions import Fraction
from l02_scoring import ProtocolError
from material_contract import read_json


STATUSES = {'verified_pass', 'verified_fail', 'candidate_incomplete', 'blocked_candidate', 'unassessed'}


def load_rubric(path):
    value = read_json(path)
    if type(value) is not dict or value.get('format') != 'l02-rubric/1' or value.get('case') != 'L02' or value.get('status') not in ('draft', 'frozen'):
        raise ProtocolError('facility_rubric_invalid', 'explicit L02 rubric/version/status required')
    try:
        criteria = [row for group in value['groups'] for row in group['criteria']]
        ids = [row['id'] for row in criteria]
        if any(type(i) is not str or not i.strip() for i in ids) or len(set(ids)) != len(ids) or len(ids) != value['criterion_count']:
            raise ValueError('unique complete criterion IDs required')
        for row in criteria:
            if type(row['critical']) is not bool or type(row['quality']) is not bool or type(row['weight']) not in (int, str) or Fraction(row['weight']) <= 0:
                raise ValueError('typed criterion flags and positive rational weights required')
            if row['quality'] and not row['critical']:
                raise ValueError('quality cannot be compensated by method points')
        if Fraction(value['total_weight']) != 100 or sum(Fraction(row['weight']) for row in criteria) != 100:
            raise ValueError('fixed denominator must be exactly 100')
        publication = value['publication']
        if type(publication['good_score_at_least']) is not int or not 0 <= publication['good_score_at_least'] <= 100:
            raise ValueError('pre-candidate author comparison threshold required')
        required = publication['requires_readiness']
        if type(required) is not list or not required or len(set(required)) != len(required) or any(type(value['readiness'].get(k)) is not bool for k in required):
            raise ValueError('explicit typed readiness facts required')
    except (ValueError, TypeError, KeyError, ZeroDivisionError) as e:
        raise ProtocolError('facility_rubric_invalid', str(e)) from e
    return value, criteria


def aggregate(rubric, criteria, findings):
    """Evidence truth is established outside this arithmetic/status primitive."""
    ids = [row['id'] for row in findings]
    expected = {row['id'] for row in criteria}
    if len(ids) != len(set(ids)) or set(ids) != expected:
        raise ProtocolError('facility_grade_mapping_invalid', 'every declared leaf exactly once, including pending dependencies')
    mapping = {row['id']: row for row in findings}
    if any(row.get('status') not in STATUSES for row in findings):
        raise ProtocolError('facility_grade_mapping_invalid', 'typed candidate/evaluator assessment states required')
    pending = [row['id'] for row in findings if row['status'] == 'unassessed']
    failed = [row['id'] for row in criteria if row['critical'] and mapping[row['id']]['status'] in {'verified_fail', 'candidate_incomplete', 'blocked_candidate'}]
    required = rubric['publication']['requires_readiness']
    blockers = ([] if rubric['status'] == 'frozen' else ['rubric_not_frozen']) + ['readiness:' + k for k in required if not rubric['readiness'][k]]
    blockers += ['unassessed:' + identifier for identifier in pending]
    result = {'status': 'assessment_incomplete' if pending else 'draft_assessment_complete' if blockers else 'graded',
        'fixed_denominator': 100, 'total_score': None, 'study_complete': None,
        'quality_success': None, 'good': None, 'known_critical_failures': failed,
        'unassessed': pending, 'publication_blockers': blockers,
        'counts': {status: sum(row['status'] == status for row in findings) for status in sorted(STATUSES)}}
    if not blockers:
        total = sum(Fraction(row['weight']) for row in criteria if mapping[row['id']]['status'] == 'verified_pass')
        research = [row for row in criteria if row['critical'] and not row['quality']]
        quality = [row for row in criteria if row['quality']]
        result['total_score_exact'] = str(total)
        result['total_score'] = total.numerator if total.denominator == 1 else float(total)
        result['study_complete'] = all(mapping[row['id']]['status'] == 'verified_pass' for row in research)
        result['quality_success'] = all(mapping[row['id']]['status'] == 'verified_pass' for row in quality)
        result['good'] = result['study_complete'] and result['quality_success'] and total >= rubric['publication']['good_score_at_least']
    return result
