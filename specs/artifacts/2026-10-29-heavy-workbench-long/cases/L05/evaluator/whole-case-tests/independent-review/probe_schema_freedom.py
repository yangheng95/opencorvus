from pathlib import Path
import sqlite3,json,importlib.util
R=Path(__file__).parent;C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L05')
db=R/'view-alias.sqlite';mapping=json.loads((R/'view-alias-map.json').read_text());c=sqlite3.connect(db);c.execute('alter table postings rename to real_outgoing');c.commit();literal="SELECT tenant,event_id FROM postings WHERE source_kind='business' AND source_id='Z'";error=None
try:c.execute(literal).fetchone()
except sqlite3.Error as e:error={'type':type(e).__name__,'message':str(e)}
c.close();mapping['postings']['table']='real_outgoing';spec=importlib.util.spec_from_file_location('schema_reader',C/'public/logical_store.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);actual=module.read(db,mapping)
out=dict(actual_logical_projection_rows=len(actual['postings']),actual_declared_table='real_outgoing',actual_fixture_type='same persistent view/alias control extended by legal table rename; not a new programme/native',public_exercise_literal=literal,literal_actual_error=error,legacy_send_source='public/legacy_app.py also directly SELECTs and UPDATEs postings',issue='Public promises internal table/column freedom through map, but exercise execute chooses old Z by hardcoded live postings and then old legacy send queries same candidate DB. Correct custom mapped storage requires an undocumented compatibility view/update trigger.',candidate_baseline_failure=False)
(R/'schema-freedom-probe.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(out,indent=2))
