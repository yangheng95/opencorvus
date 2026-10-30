"""Logical SQLite projection with quoted identifiers; no candidate SQL execution."""
import json,sqlite3
from pathlib import Path
FIELDS={
'journal':'seq tenant request_id event_id revision kind amount_minor payload',
'opening':'tenant amount_minor','adjustments':'tenant adjustment_id amount_minor approval','notes':'tenant note_id body',
'projection':'tenant event_id revision status amount_minor',
'postings':'seq tenant event_id payload source_kind source_id boundary_seq epoch receipt_id',
'control':'id epoch active','repair_cuts':'repair_id epoch boundary_seq snapshot_json phase completed_epoch',
'samples':'window_id pending total pending_ratio conflicts mismatched_sources active_json','alerts':'window_id alarm status'}
class CandidateDataError(ValueError):pass
def quote(name):
    if not isinstance(name,str) or not name or '\x00' in name:raise CandidateDataError('candidate_logical_identifier_invalid')
    return '"'+name.replace('"','""')+'"'
def read(db,mapping,subset=None):
    if not isinstance(mapping,dict):raise CandidateDataError('candidate_logical_map_invalid')
    out={}
    try:
        c=sqlite3.connect(Path(db).resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
        try:
            for table in subset or FIELDS:
                spec=mapping[table];columns=spec['columns'];fields=FIELDS[table].split()
                if not isinstance(columns,dict):raise CandidateDataError('candidate_logical_columns_invalid')
                sql='SELECT '+','.join(quote(columns[k])+' AS '+quote(k) for k in fields)+' FROM '+quote(spec['table'])
                out[table]=[dict(row) for row in c.execute(sql)]
        finally:c.close()
    except (KeyError,TypeError,sqlite3.Error,OSError) as e:raise CandidateDataError('candidate_logical_projection_invalid:'+str(e)) from e
    return out
def original(db):return read(db,{t:{'table':t,'columns':{k:k for k in f.split()}} for t,f in FIELDS.items()},['journal','opening','adjustments','notes','projection','postings','control'])
def remote(db):
    c=sqlite3.connect(Path(db).resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
    try:return {t:[dict(x) for x in c.execute('SELECT * FROM '+t)] for t in ('effects','requests','drop_once')}
    finally:c.close()
