"""Whole-program consumers for SQL identifiers/data and offset-aware session ledgers."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile

from delivery_domain_cases import csv_text
from delivery_verification_scope import same_value

CONTRACTS={
    'query-export': '''Repair the supplied SQLite query-export project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
INPUT_DIRECTORY contains source.db and UTF-8 export.json {exports:[{name:TEXT,
table:TABLE_NAME,columns:[COLUMN_NAME,...],match:{column:COLUMN_NAME,value:TEXT},
order_by:[COLUMN_NAME,...]},...]}. Names refer to existing ordinary SQLite tables and
columns. All identifiers are nonempty, contain no NUL, and may contain spaces, Unicode,
SQL keywords, punctuation or double quotes. They are identifiers, not SQL expressions.
Every requested column exists; columns/order_by are nonempty and distinct within each
list. Export names are distinct exact nonempty text. match.value is exact text data,
including apostrophes, SQL-looking text, numeric-looking text and case distinctions.
Filter rows by exact SQLite BINARY text equality; order by the listed columns ascending
using SQLite ordering. Source cells are TEXT, INTEGER or NULL. Preserve value types,
identifier spelling, requested column order and export order. Output UTF-8 JSON
{exports:[{name:EXACT_NAME,columns:EXACT_COLUMN_LIST,rows:[[CELL,...],...]},...]} and exit0.
Read the existing database without altering its schema, data, indexes or user_version.
Do not confuse identifier quoting with value binding. The final zipapp works from
arbitrary cwd using only itself, Python and supplied inputs. Actual exported values
and source preservation matter, not merely successful SQL or JSON serialization.
''',
    'utc-ledger': '''Repair the UTC session-ledger report project. Deliver deliverable.pyz,
maintainable source and concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
INPUT_DIRECTORY contains UTF-8 sessions.csv with named columns session,started_at,ended_at.
Column reordering, extra metadata, CSV quoting, CRLF/LF are legal. session is distinct,
exact nonempty text, including numeric-looking IDs, punctuation, whitespace or Unicode.
Each timestamp is YYYY-MM-DDTHH:MM:SS with optional 1-6 fractional digits followed by
Z or a numeric +/-HH:MM offset; it denotes an aware instant. Convert both instants to
UTC before ordering, subtraction or date grouping; never strip an offset as decoration.
For each input row emit {session:EXACT_TEXT,start_utc:CANONICAL,end_utc:CANONICAL,
seconds:NUMBER,start_utc_date:YYYY-MM-DD} in original input order. CANONICAL is exactly
YYYY-MM-DDTHH:MM:SS.ffffffZ with six fractional digits. Group whole session durations
by their start UTC date (do not split midnight-spanning sessions), sorted by date.
Exit0 and JSON {sessions:[...],daily:[{date:DATE,sessions:INTEGER,seconds:NUMBER},...],
total_seconds:NUMBER}. Numeric tolerance is 1e-8 absolute. Zero durations are legal.
For the first row whose end instant precedes its start, exit2 and JSON
{error:{code:NEGATIVE_INTERVAL,session:EXACT_TEXT}} instead of a successful report.
Local clock labels can run backwards while elapsed UTC time is positive; equivalent
offset spellings represent the same instant. Preserve session text independently of
timestamp normalization. The final zipapp runs from arbitrary cwd with Python/inputs.
''',
}

PROTOTYPES={
    'query-export': '''import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);c=sqlite3.connect(root/"source.db");results=[]
for r in json.loads((root/"export.json").read_text(encoding="utf-8"))["exports"]:
    sql="SELECT "+",".join(r["columns"])+" FROM "+r["table"]+" WHERE "+r["match"]["column"]+" = '"+r["match"]["value"]+"' ORDER BY "+",".join(r["order_by"])
    results.append(dict(name=r["name"],columns=r["columns"],rows=[list(row) for row in c.execute(sql)]))
c.close();Path(a.output).write_text(json.dumps(dict(exports=results),ensure_ascii=False),encoding="utf-8")
''',
    'utc-ledger': '''import argparse,csv,json
from datetime import datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();rows=[];daily={}
with open(Path(a.input)/"sessions.csv",encoding="utf-8",newline="") as f:
    for r in csv.DictReader(f):
        start=datetime.fromisoformat(r["started_at"][:19]);end=datetime.fromisoformat(r["ended_at"][:19]);seconds=(end-start).total_seconds()
        if seconds<0:Path(a.output).write_text(json.dumps(dict(error=dict(code="NEGATIVE_INTERVAL",session=r["session"]))),encoding="utf-8");raise SystemExit(2)
        day=start.date().isoformat();rows.append(dict(session=r["session"],start_utc=start.isoformat(timespec="microseconds")+"Z",end_utc=end.isoformat(timespec="microseconds")+"Z",seconds=seconds,start_utc_date=day));bucket=daily.setdefault(day,dict(date=day,sessions=0,seconds=0));bucket["sessions"]+=1;bucket["seconds"]+=seconds
Path(a.output).write_text(json.dumps(dict(sessions=rows,daily=[daily[k] for k in sorted(daily)],total_seconds=sum(r["seconds"] for r in rows)),ensure_ascii=False),encoding="utf-8")
''',
}

def identifier(value):
    return '"'+value.replace('"','""')+'"'

def sql_cases():
    def request(name,table,columns,column,value,order):
        return dict(name=name,table=table,columns=columns,match=dict(column=column,value=value),order_by=order)
    def result(req,rows):return dict(name=req['name'],columns=req['columns'],rows=rows)
    plain=request('red rows','events',['seq','amount'],'team','red',['seq'])
    quoted=request(' 01 ','group',['select','a"b'],'team name','x',['select'])
    unicode=request('数据','数据 名',['编号','值'],'值','中',['编号'])
    literals=[request('apostrophe','items',['code','note'],'note',"O'Reilly",['code']),
              request('literal SQL','items',['code','note'],'note',"' OR 1=1 --",['code']),
              request('case','items',['code','note'],'note','code',['code'])]
    return [
        dict(name='ordinary-identifiers',tables=[dict(name='events',columns=['seq','team','amount'],rows=[['001','red',7],['002','blue',9],['003','red',11]])],requests=[plain],expected=dict(exports=[result(plain,[['001',7],['003',11]])])),
        dict(name='quoted-keyword-unicode-identifiers',tables=[dict(name='group',columns=['select','team name','a"b'],rows=[['001','x','keep'],['002','y','skip']]),dict(name='数据 名',columns=['编号','值'],rows=[['b','文'],['a','中']])],requests=[quoted,unicode],expected=dict(exports=[result(quoted,[['001','keep']]),result(unicode,[['a','中']])])),
        dict(name='literal-text-and-case',tables=[dict(name='items',columns=['code','note','kind'],rows=[['001',"O'Reilly",'key'],['002',"' OR 1=1 --",'key'],['003','normal','other'],['004','CODE','case'],['005','code','case']])],requests=literals,expected=dict(exports=[result(literals[0],[['001',"O'Reilly"]]),result(literals[1],[['002',"' OR 1=1 --"]]),result(literals[2],[['005','code']])])),
    ]

def seed(path,fixture):
    with closing(sqlite3.connect(path)) as c,c:
        c.execute('PRAGMA user_version=7')
        for i,t in enumerate(fixture['tables']):
            c.execute('CREATE TABLE '+identifier(t['name'])+' ('+','.join(identifier(x) for x in t['columns'])+')')
            c.executemany('INSERT INTO '+identifier(t['name'])+' VALUES('+','.join('?' for _ in t['columns'])+')',t['rows'])
            c.execute('CREATE INDEX '+identifier('preserve index '+str(i))+' ON '+identifier(t['name'])+'('+identifier(t['columns'][0])+')')

def database_state(path):
    with closing(sqlite3.connect(path)) as c:
        schema=c.execute('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').fetchall()
        tables=[r[1] for r in schema if r[0]=='table']
        return dict(schema=schema,rows={name:c.execute('SELECT * FROM '+identifier(name)+' ORDER BY rowid').fetchall() for name in tables},version=c.execute('PRAGMA user_version').fetchall(),integrity=c.execute('PRAGMA integrity_check').fetchall())

def utc_cases():
    def row(session,start,end):return dict(session=session,started_at=start,ended_at=end)
    def emitted(session,start,end,seconds,day):return dict(session=session,start_utc=start,end_utc=end,seconds=seconds,start_utc_date=day)
    def report(rows,daily,total):return dict(sessions=rows,daily=[dict(date=d,sessions=n,seconds=s) for d,n,s in daily],total_seconds=total)
    data=[
        dict(name='ordinary-z',rows=[row('A','2026-04-01T10:00:00Z','2026-04-01T10:01:30Z'),row('B','2026-04-01T11:00:00Z','2026-04-01T11:00:30Z')],expected=report([emitted('A','2026-04-01T10:00:00.000000Z','2026-04-01T10:01:30.000000Z',90,'2026-04-01'),emitted('B','2026-04-01T11:00:00.000000Z','2026-04-01T11:00:30.000000Z',30,'2026-04-01')],[('2026-04-01',2,120)],120),exit=0),
        dict(name='equivalent-offsets-and-local-reversal',rows=[row('001','2026-04-02T00:30:00+02:00','2026-04-01T22:35:00Z'),row('A','2026-04-01T17:30:00-05:00','2026-04-01T22:35:00+00:00')],expected=report([emitted(s,'2026-04-01T22:30:00.000000Z','2026-04-01T22:35:00.000000Z',300,'2026-04-01') for s in ['001','A']],[('2026-04-01',2,600)],600),exit=0),
        dict(name='utc-midnight-fractional-and-text-id',rows=[row(' 组,\n','2026-04-01T23:59:59.500000Z','2026-04-02T00:00:00.250000+00:00'),row('02','2026-04-02T05:30:00+05:30','2026-04-02T00:00:02Z')],expected=report([emitted(' 组,\n','2026-04-01T23:59:59.500000Z','2026-04-02T00:00:00.250000Z',0.75,'2026-04-01'),emitted('02','2026-04-02T00:00:00.000000Z','2026-04-02T00:00:02.000000Z',2,'2026-04-02')],[('2026-04-01',1,0.75),('2026-04-02',1,2)],2.75),exit=0),
        dict(name='negative-instant-error',rows=[row('bad','2026-04-02T00:00:00Z','2026-04-01T19:59:00-04:00')],expected=dict(error=dict(code='NEGATIVE_INTERVAL',session='bad')),exit=2),
    ]
    for i,f in enumerate(data):f['csv']=csv_text(['session','started_at','ended_at'],f['rows'],varied=i in (1,2))
    return data

def setup(kind,project):
    project.mkdir(parents=True,exist_ok=True)
    (project/'CONTRACT.md').write_text(CONTRACTS[kind],encoding='utf-8')
    (project/'main.py').write_text(PROTOTYPES[kind],encoding='utf-8')
    sample=project/'sample';sample.mkdir()
    if kind=='query-export':
        fixture=sql_cases()[0];seed(sample/'source.db',fixture)
        (sample/'export.json').write_text(json.dumps(dict(exports=fixture['requests'])),encoding='utf-8')
    else:(sample/'sessions.csv').write_bytes(utc_cases()[0]['csv'].encode('utf-8'))
    return dict(case=kind,contract=CONTRACTS[kind])

def grade(kind,project,output):
    output.mkdir(parents=True,exist_ok=True);results=[]
    with tempfile.TemporaryDirectory(prefix='oc-selfcheck-consumer-') as directory:
        root=Path(directory);app=root/'original-delivered.pyz'
        if (project/'deliverable.pyz').is_file():app.write_bytes((project/'deliverable.pyz').read_bytes())
        for i,fixture in enumerate(sql_cases() if kind=='query-export' else utc_cases()):
            work=root/str(i);source=work/'input';source.mkdir(parents=True);saved=output/str(i);saved.mkdir()
            if kind=='query-export':
                seed(source/'source.db',fixture);before=database_state(source/'source.db')
                (source/'export.json').write_text(json.dumps(dict(exports=fixture['requests']),ensure_ascii=False),encoding='utf-8')
                (saved/'source-before.db').write_bytes((source/'source.db').read_bytes());(saved/'export.json').write_bytes((source/'export.json').read_bytes())
            else:(source/'sessions.csv').write_bytes(fixture['csv'].encode('utf-8'));(saved/'sessions.csv').write_bytes((source/'sessions.csv').read_bytes())
            target=work/'result.json';argv=[sys.executable,'-I',str(app),str(source),'--output',str(target)]
            row=dict(name=fixture['name'],argv=argv,cwd=str(work),expected=fixture['expected'])
            try:
                p=subprocess.run(argv,cwd=work,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
                row.update(exit=p.returncode,stdout=p.stdout,stderr=p.stderr)
                actual=json.loads(target.read_text(encoding='utf-8'))
                row.update(actual=actual,passed=p.returncode==fixture.get('exit',0) and same_value(actual,fixture['expected'],abs_tol=0 if kind=='query-export' else 1e-8))
                if kind=='query-export':
                    after=database_state(source/'source.db');row.update(source_before=before,source_after=after,source_preserved=after==before);row['passed']=row['passed'] and row['source_preserved']
                    (saved/'source-after.db').write_bytes((source/'source.db').read_bytes())
                (saved/'result.json').write_bytes(target.read_bytes())
            except (OSError,ValueError,KeyError,subprocess.TimeoutExpired) as error:row.update(passed=False,error=str(error))
            results.append(row)
    report=dict(case=kind,passed=all(r['passed'] for r in results),scope='external registered consumption, not model self-verification evidence',results=results)
    (output/'grade.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['setup','grade']);p.add_argument('kind',choices=CONTRACTS);p.add_argument('project',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
    report=setup(a.kind,a.project) if a.action=='setup' else grade(a.kind,a.project,a.output)
    print(json.dumps(report,ensure_ascii=True));raise SystemExit(0 if a.action=='setup' or report['passed'] else 1)
