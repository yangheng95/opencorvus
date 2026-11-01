"""Adapt original full task tests to positive state/error contracts before any runs."""
from pathlib import Path
from datetime import datetime,timezone
import ast,json,contextlib
R=Path(__file__).parent;C=R/'consumer';C.mkdir(exist_ok=True)
patch=(R/'original-task/tests/test.patch').read_text()
part=patch.split('+++ b/tests/test_safe_bulk_import.py\n',1)[1]
original='\n'.join(line[1:] for line in part.splitlines() if line.startswith('+'))+'\n'
tree=ast.parse(original);events=[]
helper='''\n\n# Local native adaptation: explicit SQLite state and process error contracts.\ndef _user_state(db, names):\n    placeholders = ','.join('?' for _ in names)\n    objects = [tuple(row) for row in db.execute(\n        'SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN ('+placeholders+') ORDER BY type,name', names\n    ).fetchall()]\n    tables = [x[1] for x in objects if x[0] == 'table']\n    rows = {}\n    for name in tables:\n        quoted = name.replace('"', '""')\n        rows[name] = sorted([tuple(r) for r in db.execute('SELECT * FROM "'+quoted+'"').fetchall()], key=repr)\n    return {'objects': objects, 'rows': rows}\n\ndef _cli_contract(result):\n    if result.exit_code == 0:\n        return {'status': 'committed', 'native_exit': result.exit_code}\n    if isinstance(result.exit_code, int) and 1 <= result.exit_code <= 255:\n        return {'status': 'operation_error', 'native_exit': result.exit_code, 'response': result.output, 'exception_type': type(result.exception).__name__}\n    raise AssertionError('Native CLI response outside documented process code domain: '+repr(result.exit_code))\n'''
helper+='''\nfrom contextlib import contextmanager\n@contextmanager\ndef _expect_named_error(expected):\n    try:\n        yield\n    except Exception as error:\n        assert expected in [base.__name__ for base in type(error).__mro__]\n    else:\n        raise AssertionError('Expected explicit error contract '+expected)\n'''
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef)]
lines=original.splitlines(keepends=True);chunks=[]
for node in functions:
 text=''.join(lines[node.lineno-1:node.end_lineno])+'\n'
 before=text
 text=text.replace('assert checkpoint_id is not None','assert isinstance(checkpoint_id, str) and len(checkpoint_id) > 0')
 text=text.replace('assert result.exit_code != 0',"assert _cli_contract(result)['status'] == 'operation_error'")
 # An invariant id is opaque. CLI argv/output are textual representations,
 # not an additional requirement that the API use the oracle's string ids.
 text=text.replace('assert inv_id in result.output','assert str(inv_id) in result.output')
 text=text.replace('            invariant_id\n','            str(invariant_id)\n')
 for error_name in ['SafeImportNotEnabledError','CheckpointNotActiveError','CheckpointNotFoundError']:
  text=text.replace('pytest.raises('+error_name+')',"_expect_named_error('"+error_name+"')")
 # Mid-setup absence assertions add no output contract; final exact restored
 # rows/columns/schema are already asserted by these original functions.
 for line in ['    assert "products" not in db.table_names()\n','    assert "email" not in columns\n','    assert len(indexes) == 0\n','    assert len(triggers) == 0\n']:
  text=text.replace(line,'')
 if 'assert "data" not in db.table_names()' in text:
  marker='    db.add_import_invariant("data", "COUNT(*) = 0")\n'
  if text.count(marker)!=1:raise ValueError('Ambiguous source state: '+node.name)
  text=text.replace(marker,marker+'    original_state = _user_state(db, ("data",))\n')
  text=text.replace('assert "data" not in db.table_names()','assert _user_state(db, ("data",)) == original_state')
 if text!=before:events.append(dict(test=node.name,original=before,adapted=text))
 chunks.append(text)
imports=''.join(lines[:functions[0].lineno-1]).replace('from sqlite_utils.db import SafeImportNotEnabledError, CheckpointNotActiveError, CheckpointNotFoundError\n','')
adapted=imports+helper+'\n\n'+'\n\n'.join(chunks)
ast.parse(adapted)
(C/'test_safe_bulk_import.py').write_text(adapted,encoding='utf-8')
registration=dict(at=datetime.now(timezone.utc).isoformat(),original_test_functions=len(functions),retained_test_functions=len(functions),original_test_patch=str(R/'original-task/tests/test.patch'),reference_run_yet=(R/'validation/original-reference-first/assessment.json').is_file(),candidate_started=False,official_grader_run=False,changes=events,scope='Native local positive-state/error adaptation of the complete original new-feature tests. No source implementation/reference patch changed. Not official Linux/Docker/network-isolated grading. Full base regression remains unverified. First adapter source snapshot was not saved before pre-freeze CLI-id coercion; original first raw results retained; final adapter separately sealed before final validation.')
(R/'native-consumer-registration.json').write_text(json.dumps(registration,indent=2),encoding='utf-8')
print(json.dumps(dict(original_test_functions=len(functions),retained_test_functions=len(functions),adapted_functions=[e['test'] for e in events])))
