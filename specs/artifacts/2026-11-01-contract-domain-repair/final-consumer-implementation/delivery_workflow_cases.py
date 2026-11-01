"""Two distinct real file/database workflows for the current finite product E2E run."""
import base64
from contextlib import closing
import csv
import io
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import zipfile

from delivery_verification_scope import same_value

CONTRACTS = {
    "bundle": """Repair this manifest-driven file delivery project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff; Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_ZIP
INPUT_DIRECTORY contains manifest.json {files:[{source:RELATIVE_PATH,target:ZIP_PATH},...]}.
Source paths are relative to that directory; targets are distinct relative forward-slash
ZIP paths; all paths are nonempty and contain no traversal/absolute components.
Legal names include Unicode, spaces, dots and commas; nested paths and duplicate source
basenames in different directories are supported. Inputs may be binary, empty or text.
Copy the exact bytes of every specified source to its exact target, without text decoding.
The ZIP also contains _bundle_index.json {files:[{path:TARGET,bytes:INTEGER},...]} sorted
by target Unicode order. Other payload files must not be included; directory entries are
allowed. manifest order does not affect the delivered logical tree or sorted index.
The zipapp must run from an arbitrary working directory with only its own archive,
Python and the supplied inputs. Verify the actual resulting ZIP, not just zipapp exit.
""",
    "stock": """Repair this SQLite stock-batch import project. Deliver deliverable.pyz,
maintainable source and concise tested handoff; Python 3 standard library only.
Invocation: python deliverable.pyz INPUT_CSV --db DATABASE --output REPORT_JSON
CSV is UTF-8 with named item,delta,unit_cost_cents columns, reordered/extra metadata
columns and all legal CSV quoting/CRLF/LF supported. item is exact nonempty Unicode
text including quotes, commas and embedded newlines; delta is signed integer, cost
nonnegative integer. Apply rows in order in one atomic transaction. Existing stock rows
add delta and replace cost; new rows start quantity zero plus delta. Every resulting
quantity must be nonnegative. On success exit 0 and JSON {success:true,processed:N}.
On the first insufficient-stock record, roll back the entire batch, exit 2 and JSON
{success:false,error:{code:"INSUFFICIENT_STOCK",record:ONE_BASED_DATA_RECORD,item:TEXT}}.
The existing SQLite schema has stock(item TEXT PRIMARY KEY,quantity INTEGER NOT NULL
CHECK(quantity>=0),unit_cost_cents INTEGER NOT NULL). Preserve all user tables, indexes,
triggers, prior rows and their semantics; execute ordinary INSERT/UPDATE so existing
audit triggers record actual changes. No replacement of the database or stock table.
Consume the exact supplied DB path and persist success across physical reopening.
Provide the real packaged CLI and test both success and explicit atomic-error behavior.
""",
}

PROTOTYPES = {
    "bundle": '''import argparse,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args()
root=Path(a.input);index=[]
with zipfile.ZipFile(a.output,"w") as z:
    for row in json.loads((root/"manifest.json").read_text())["files"]:
        text=(root/row["source"]).read_text();target=Path(row["target"]).name
        z.writestr(target,text);index.append(dict(path=target,bytes=len(text)))
    z.writestr("_bundle_index.json",json.dumps(dict(files=index)))
''',
    "stock": '''import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--db",required=True);p.add_argument("--output",required=True);a=p.parse_args()
c=sqlite3.connect(a.db);lines=Path(a.input).read_text().splitlines();done=0
for line in lines[1:]:
    item,delta,cost=line.split(",");old=c.execute("select quantity from stock where item=?",(item,)).fetchone();qty=(old[0] if old else 0)+int(delta)
    if qty<0:
        Path(a.output).write_text(json.dumps(dict(success=False,error=dict(code="INSUFFICIENT_STOCK",record=done+1,item=item))));raise SystemExit(2)
    c.execute("insert into stock values(?,?,?) on conflict(item) do update set quantity=excluded.quantity,unit_cost_cents=excluded.unit_cost_cents",(item,qty,int(cost)));c.commit();done+=1
Path(a.output).write_text(json.dumps(dict(success=True,processed=done)))
''',
}

def bundle_cases():
    rows = [
        ("nested-binary", [("left/a.bin", "delivery/raw/a.bin", bytes([0,255,13,10,0])), ("right/a.bin", "other/a.bin", b"other\r\n"), ("empty", "empty", b"")]),
        ("unicode-order", [("资料/a,b.txt", "交付/含 空格.txt", "精确\r\n字符".encode()), ("meta", "z/final.txt", b"end")]),
        ("reversed-manifest", [("two", "z.txt", b"second"), ("one", "a.txt", b"first")]),
    ]
    cases = [dict(name=name, entries=[dict(source=s,target=t,base64=base64.b64encode(b).decode()) for s,t,b in entries]) for name,entries in rows]
    # Source fields belong to the native filesystem; ZIP targets have a distinct
    # forward-slash contract. pathlib supplies the host's allowed representation.
    native = dict(name="native-source-representation", entries=[
        {**entry, "source": str(Path(entry["source"]))}
        for entry in cases[0]["entries"]
    ])
    return [*cases, native]

def stock_cases():
    result=[]
    for name, quoted, error in [("success",False,False),("quoted-reordered",True,False),("atomic-error",True,True)]:
        item='A,"组"\nZ' if quoted else "Widget"; new="新,品" if quoted else "New"
        records=[dict(item=item,delta=-3,unit_cost_cents=120),dict(item=new,delta=6,unit_cost_cents=200),dict(item=item,delta=-99 if error else 2,unit_cost_cents=130)]
        columns=["note","unit_cost_cents","item","delta"] if quoted else ["item","delta","unit_cost_cents"]
        stream=io.StringIO(newline=""); w=csv.DictWriter(stream,fieldnames=columns,lineterminator="\r\n" if quoted else "\n");w.writeheader()
        w.writerows([dict(r,note='extra, "行"\n值') if quoted else r for r in records])
        initial=sorted([(item,10,100),("Other",4,50)])
        expected=initial if error else sorted([(item,9,130),(new,6,200),("Other",4,50)])
        events=[] if error else [(item,10,7),(new,None,6),(item,7,9)]
        report=dict(success=False,error=dict(code="INSUFFICIENT_STOCK",record=3,item=item)) if error else dict(success=True,processed=3)
        result.append(dict(name=name,csv=stream.getvalue(),initial=initial,stock=expected,events=events,report=report,exit=2 if error else 0))
    return result

def seed(path, initial):
    with closing(sqlite3.connect(path)) as c, c:
        c.executescript("CREATE TABLE stock(item TEXT PRIMARY KEY,quantity INTEGER NOT NULL CHECK(quantity>=0),unit_cost_cents INTEGER NOT NULL);CREATE INDEX cost_index ON stock(unit_cost_cents);CREATE TABLE user_notes(value TEXT);INSERT INTO user_notes VALUES('preserve me');CREATE TABLE stock_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,item TEXT,before_quantity INTEGER,after_quantity INTEGER);")
        c.executemany("INSERT INTO stock VALUES(?,?,?)", initial)
        c.executescript("CREATE TRIGGER stock_insert AFTER INSERT ON stock BEGIN INSERT INTO stock_events(item,before_quantity,after_quantity) VALUES(new.item,NULL,new.quantity);END;CREATE TRIGGER stock_update AFTER UPDATE ON stock BEGIN INSERT INTO stock_events(item,before_quantity,after_quantity) VALUES(new.item,old.quantity,new.quantity);END;")

def snapshot(path):
    with closing(sqlite3.connect(path)) as c:
        return dict(schema=c.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall(),stock=c.execute("SELECT * FROM stock ORDER BY item").fetchall(),events=c.execute("SELECT item,before_quantity,after_quantity FROM stock_events ORDER BY seq").fetchall(),notes=c.execute("SELECT * FROM user_notes").fetchall(),integrity=c.execute("PRAGMA integrity_check").fetchall())

def setup(kind, project):
    project.mkdir(parents=True,exist_ok=True)
    (project/"main.py").write_text(PROTOTYPES[kind],encoding="utf-8")
    (project/"CONTRACT.md").write_text(CONTRACTS[kind],encoding="utf-8")
    if kind=="bundle":
        sample=project/"sample";sample.mkdir(); write_bundle_input(sample,bundle_cases()[0])
    else:
        fixture=stock_cases()[0];(project/"sample.csv").write_bytes(fixture["csv"].encode());seed(project/"sample.db",fixture["initial"])
    return dict(case=kind,contract=CONTRACTS[kind])

def write_bundle_input(root, fixture):
    manifest=[]
    for row in fixture["entries"]:
        source=root/row["source"];source.parent.mkdir(parents=True,exist_ok=True);source.write_bytes(base64.b64decode(row["base64"]))
        manifest.append(dict(source=row["source"],target=row["target"]))
    (root/"manifest.json").write_text(json.dumps(dict(files=manifest),ensure_ascii=False),encoding="utf-8")

def grade(kind, project, output):
    output.mkdir(parents=True,exist_ok=True);results=[]
    with tempfile.TemporaryDirectory(prefix="oc-workflow-consumer-") as directory:
        root=Path(directory);app=root/"delivered.pyz"
        if (project/"deliverable.pyz").is_file():app.write_bytes((project/"deliverable.pyz").read_bytes())
        fixtures=bundle_cases() if kind=="bundle" else stock_cases()
        for i, fixture in enumerate(fixtures):
            work=root/str(i);work.mkdir();saved=output/str(i);saved.mkdir();row=dict(name=fixture["name"])
            if kind=="bundle":
                write_bundle_input(work,fixture)
                row["source_admissibility"] = [dict(source=entry["source"],target=entry["target"],native_path=str(Path(entry["source"])),physical_bytes_match=(work/entry["source"]).read_bytes()==base64.b64decode(entry["base64"])) for entry in fixture["entries"]]
                row["contract_basis"] = "source: native filesystem Path; target: original forward-slash ZIP contract; contents: independently supplied bytes"
                for source in work.rglob("*"):
                    if source.is_file():
                        dest=saved/"inputs"/source.relative_to(work);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source.read_bytes())
                target=work/"result.zip";argv=[sys.executable,"-I",str(app),str(work),"--output",str(target)]
            else:
                data=work/"input.csv";data.write_bytes(fixture["csv"].encode());db=work/"inventory.db";seed(db,fixture["initial"]);before=snapshot(db)
                (saved/"input.csv").write_bytes(data.read_bytes());(saved/"before.json").write_text(json.dumps(before,ensure_ascii=False,indent=2),encoding="utf-8")
                target=work/"report.json";argv=[sys.executable,"-I",str(app),str(data),"--db",str(db),"--output",str(target)]
            row.update(argv=argv,cwd=str(work))
            try:
                done=subprocess.run(argv,cwd=work,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=30)
                row.update(exit=done.returncode,stdout=done.stdout,stderr=done.stderr)
                if kind=="bundle":
                    with zipfile.ZipFile(target) as z:
                        payload={n:base64.b64encode(z.read(n)).decode() for n in z.namelist() if not n.endswith("/") and n!="_bundle_index.json"}
                        index=json.loads(z.read("_bundle_index.json"))
                        expected={r["target"]:r["base64"] for r in fixture["entries"]}
                        expected_index=dict(files=[dict(path=n,bytes=len(base64.b64decode(b))) for n,b in sorted(expected.items())])
                        row.update(actual=dict(payload=payload,index=index),expected=dict(payload=expected,index=expected_index),passed=done.returncode==0 and payload==expected and same_value(index,expected_index,abs_tol=0))
                else:
                    after=snapshot(db);report=json.loads(target.read_text(encoding="utf-8"))
                    expected={**before,"stock":[tuple(r) for r in fixture["stock"]],"events":[tuple(r) for r in fixture["events"]]}
                    row.update(actual=dict(database=after,report=report),expected=dict(database=expected,report=fixture["report"]),passed=done.returncode==fixture["exit"] and after==expected and same_value(report,fixture["report"],abs_tol=0))
                    (saved/"inventory.db").write_bytes(db.read_bytes())
                if target.is_file():(saved/target.name).write_bytes(target.read_bytes())
            except (OSError,ValueError,KeyError,zipfile.BadZipFile,subprocess.TimeoutExpired) as error:row.update(passed=False,error=str(error))
            results.append(row)
    report=dict(case=kind,passed=all(r["passed"] for r in results),results=results)
    (output/"grade.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    return report

if __name__=="__main__":
    import argparse
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("action",choices=["setup","grade"]);p.add_argument("kind",choices=CONTRACTS);p.add_argument("project",type=Path);p.add_argument("--output",type=Path);a=p.parse_args()
    result=setup(a.kind,a.project) if a.action=="setup" else grade(a.kind,a.project,a.output)
    print(json.dumps(result,ensure_ascii=True));sys.exit(0 if a.action=="setup" or result["passed"] else 1)
