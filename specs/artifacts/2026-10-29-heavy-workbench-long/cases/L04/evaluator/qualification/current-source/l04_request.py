"""Single data-integrity contract for both cooperating writer versions."""
import json
from pathlib import Path


class RequestError(ValueError):
    def __init__(self,field):
        self.field=field
        super().__init__('invalid_request:'+field)


def is_identity(value):return isinstance(value,str) and bool(value.strip())


def load_request(path):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result:raise RequestError('$json')
            result[key]=value
        return result
    def invalid(value):raise RequestError('$json')
    try:return json.loads(Path(path).read_text(encoding='utf-8'),object_pairs_hook=pairs,parse_constant=invalid)
    except RequestError:raise
    except (OSError,UnicodeError,ValueError,TypeError) as error:raise RequestError('$json') from error


def validate_write_request(request,version):
    if not isinstance(request,dict):raise RequestError('$')
    for field in ('op_key','entry_id'):
        if not is_identity(request.get(field)):raise RequestError(field)
    if type(request.get('epoch')) is not int or not 0<=request['epoch']<2**63:raise RequestError('epoch')
    fields={'epoch','op_key','entry_id','currency'}
    if version==1:
        fields|={'customer_id','amount'}
        if type(request.get('customer_id')) is not int or not -(2**63)<=request['customer_id']<2**63:raise RequestError('customer_id')
        if not isinstance(request.get('amount'),str) or not request['amount']:raise RequestError('amount')
    elif version==2:
        fields|={'customer_key','amount_minor','fee_minor'}
        if not is_identity(request.get('customer_key')):raise RequestError('customer_key')
        if type(request.get('amount_minor')) is not int or not -(2**63)<=request['amount_minor']<2**63:raise RequestError('amount_minor')
        if type(request.get('fee_minor')) is not int or not 0<=request['fee_minor']<2**63:raise RequestError('fee_minor')
    else:raise ValueError('writer_schema_version')
    if request.get('currency') not in ('USD','CNY'):raise RequestError('currency')
    if request.get('reversal_of') is not None and not is_identity(request['reversal_of']):raise RequestError('reversal_of')
    if set(request)-fields-{'reversal_of'}:raise RequestError('unknown_field')
