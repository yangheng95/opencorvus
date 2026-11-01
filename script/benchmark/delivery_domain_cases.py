"""Independent final-program consumers for URL and unit-conversion workflows."""
import argparse
import base64
import csv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from threading import Thread

from delivery_verification_scope import same_value

CONTRACTS = {
    "download": """Repair the batch document-download project. Deliver deliverable.pyz,
maintainable source and a concise tested handoff. Python 3 standard library only.
Invocation: python deliverable.pyz JOBS_JSON --output OUTPUT_DIRECTORY
JOBS_JSON is UTF-8 JSON {base_url:HTTP_URL,jobs:[{document_id:TEXT,output:RELATIVE_PATH},...]}.
The base URL includes an API path prefix, contains no query/fragment, and may end in '/'.
For each job GET base_url (without its final slash) + '/documents/' + the document ID
encoded as exactly one UTF-8 URL path segment. document_id is exact nonempty Unicode
business text; slashes, percent signs, query/fragment characters and spaces are legal
identifier data, not address syntax. Already percent-looking text remains literal data.
The API returns HTTP200 JSON {document_id:EXACT_ID,content_base64:BASE64}. The public
demo_server.py serves the sample; production inputs provide a reachable HTTP service.
Decode the content and write exact bytes to the job's relative native filesystem path
under OUTPUT_DIRECTORY, creating parent directories. Distinct output paths contain no
absolute/traversal components and never equal receipt.json. Text and binary/empty payloads
are supported. Source IDs and filesystem output paths belong to different contracts.
Write receipt.json {files:[{document_id:ID,output:EXACT_ORIGINAL_OUTPUT_TEXT,url:ACTUAL_URL,
bytes:INTEGER},...]} sorted by document_id. Exit 0 when all downloads are complete.
The archive must work from a different cwd using only itself, Python, inputs and API.
Preserve the base URL prefix, IDs, requested output names and exact response contents.
""",
    "temperature": """Repair the calibrated temperature-monitoring report project. Deliver
deliverable.pyz, maintainable source and concise tested handoff; Python 3 standard library.
Invocation: python deliverable.pyz INPUT_DIRECTORY --output REPORT_JSON
UTF-8 CSV files sensors.csv(sensor,gain,offset_c,low_c,high_c) and
readings.csv(sequence,sensor,temperature,unit) have required named columns; reordered
columns, extra metadata, legal quoting/CRLF/LF are supported. All decimal fields are
finite base-10 decimals. sensor and sequence are exact nonempty text, including numeric-
looking IDs, Unicode, punctuation and whitespace; sequences are distinct. Every reading
has one matching sensor. gain is positive; low_c<=high_c, either bound may be negative.
unit is C, F or K. Convert the original temperature to Celsius first:
 C: value; F: (value-32)*5/9; K: value-273.15.
Signed C/F values are valid down to absolute zero (-273.15 C or -459.67 F); Kelvin
values must be >=0. Determine physical validity in the value's original unit, before
calibration. Calibration is calibrated_c=celsius*gain+offset_c. Apply the sensor's
Celsius thresholds to calibrated_c: below low_c=LOW, above high_c=HIGH, inclusive=OK.
For valid input exit0 and JSON {success:true,readings:[{sequence:TEXT,sensor:TEXT,
celsius:NUMBER,calibrated_c:NUMBER,status:LOW|OK|HIGH},...],counts:{LOW:N,OK:N,HIGH:N}}.
Preserve reading order. Numeric output tolerance is 1e-8 absolute error.
For the first reading below absolute zero exit2 and JSON {success:false,error:
{code:BELOW_ABSOLUTE_ZERO,sequence:EXACT_TEXT,sensor:EXACT_TEXT}}. This is an explicit
error contract, not a successful monitoring report. JSON booleans retain their type.
Use the original units and calibration stages correctly; one numeric-domain guard
cannot be copied between original values, converted values and calibrated thresholds.
The final zipapp must work from arbitrary cwd using only Python and supplied inputs.
""",
}

PROTOTYPES = {
    "download": '''import argparse,base64,json,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();cfg=json.loads(Path(a.input).read_text(encoding="utf-8"));root=Path(a.output);root.mkdir(parents=True,exist_ok=True);files=[]
for job in cfg["jobs"]:
    url=cfg["base_url"].rstrip("/")+"/documents/"+job["document_id"]
    data=json.load(urllib.request.urlopen(url));raw=base64.b64decode(data["content_base64"])
    target=root/job["output"];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    files.append(dict(document_id=job["document_id"],output=job["output"],url=url,bytes=len(raw)))
(root/"receipt.json").write_text(json.dumps(dict(files=sorted(files,key=lambda r:r["document_id"])),ensure_ascii=False),encoding="utf-8")
''',
    "temperature": '''import argparse,csv,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input)
sensors={r["sensor"]:r for r in csv.DictReader(open(root/"sensors.csv",encoding="utf-8"))};rows=[];counts=dict(LOW=0,OK=0,HIGH=0)
for row in csv.DictReader(open(root/"readings.csv",encoding="utf-8")):
    value=float(row["temperature"])
    if value<0:raise ValueError("negative temperature")
    sensor=sensors[row["sensor"]];cal=value*float(sensor["gain"])+float(sensor["offset_c"])
    status="LOW" if cal<float(sensor["low_c"]) else "HIGH" if cal>float(sensor["high_c"]) else "OK";counts[status]+=1
    rows.append(dict(sequence=row["sequence"],sensor=row["sensor"],celsius=value,calibrated_c=cal,status=status))
Path(a.output).write_text(json.dumps(dict(success=True,readings=rows,counts=counts)),encoding="utf-8")
''',
}

DEMO_SERVER = '''"""Public sample HTTP dependency; run python demo_server.py --port 0."""
import argparse,base64,json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path!="/api/v1/documents/sample":self.send_error(404);return
        body=json.dumps(dict(document_id="sample",content_base64=base64.b64encode(b"sample document\\n").decode())).encode()
        self.send_response(200);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*args):pass
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--port",type=int,default=0);a=p.parse_args();server=ThreadingHTTPServer(("127.0.0.1",a.port),Handler)
    print("http://127.0.0.1:%s/api/v1"%server.server_address[1],flush=True)
    try:server.serve_forever()
    finally:server.server_close()
'''

def download_cases():
    # Wire paths are explicit independent protocol facts, not candidate quote() calls.
    return [
        dict(name="literal-reserved-identifiers",trailing_slash=False,documents=[
            dict(id="part/one",wire="/api/v1/documents/part%2Fone",output="nested/a.bin",payload="AP8NCgA="),
            dict(id="%2F",wire="/api/v1/documents/%252F",output="literal-percent.bin",payload="bGl0ZXJhbA=="),
        ]),
        dict(name="unicode-space-query-fragment",trailing_slash=True,documents=[
            dict(id="A B+%?",wire="/api/v1/documents/A%20B%2B%25%3F",output="files/a b.bin",payload=""),
            dict(id="文#页",wire="/api/v1/documents/%E6%96%87%23%E9%A1%B5",output="文档/内容.bin",payload="5L2g5aW9DQo="),
        ]),
        dict(name="native-output-representation",trailing_slash=False,documents=[
            dict(id="plain",wire="/api/v1/documents/plain",output=str(Path("本机")/"data.bin"),payload="AAECA/8="),
        ]),
    ]

def csv_text(columns, records, varied=False):
    stream=io.StringIO(newline="")
    if varied:columns=["metadata",*reversed(columns)];records=[dict(r,metadata='extra, "行"\n值') for r in records]
    writer=csv.DictWriter(stream,fieldnames=columns,lineterminator="\r\n" if varied else "\n");writer.writeheader();writer.writerows(records)
    return stream.getvalue()

def temperature_cases():
    definitions=[
        ("same-physical-temperature", "F", ["1","0","-50","50"], [("001","-40","C",-40,-40,"OK"),("002","-40","F",-40,-40,"OK"),("003","233.15","K",-40,-40,"OK")], True),
        ("calibration-and-threshold-stages", ' 组,"C"\n', ["0.5","-10","0","30"], [("01","212","F",100,40,"HIGH"),("02","273.15","K",0,-10,"LOW"),("03","68","F",20,0,"OK")], True),
        ("absolute-zero-in-original-units", "edge", ["1","0","-273.15","-200"], [("a","0","K",-273.15,-273.15,"OK"),("b","-459.67","F",-273.15,-273.15,"OK"),("c","-273.15","C",-273.15,-273.15,"OK")], False),
        ("below-absolute-zero-error", "edge", ["1","0","-300","100"], [("bad","-1","K",None,None,None)], False),
    ]
    result=[]
    for name,sensor,cal,readings,varied in definitions:
        sensors=[dict(zip(["sensor","gain","offset_c","low_c","high_c"],[sensor,*cal]))]
        rows=[dict(sequence=seq,sensor=sensor,temperature=value,unit=unit) for seq,value,unit,*_ in readings]
        if name=="below-absolute-zero-error":expected=dict(success=False,error=dict(code="BELOW_ABSOLUTE_ZERO",sequence="bad",sensor=sensor));code=2
        else:
            emitted=[dict(sequence=seq,sensor=sensor,celsius=c,calibrated_c=value,status=status) for seq,_,_,c,value,status in readings]
            expected=dict(success=True,readings=emitted,counts={status:sum(r["status"]==status for r in emitted) for status in ["LOW","OK","HIGH"]});code=0
        files={"sensors.csv":csv_text(["sensor","gain","offset_c","low_c","high_c"],sensors,varied),"readings.csv":csv_text(["sequence","sensor","temperature","unit"],rows,varied)}
        result.append(dict(name=name,files=files,expected=expected,exit=code))
    return result

def setup(kind, project):
    project.mkdir(parents=True,exist_ok=True)
    (project/"CONTRACT.md").write_text(CONTRACTS[kind],encoding="utf-8")
    (project/"main.py").write_text(PROTOTYPES[kind],encoding="utf-8")
    if kind=="download":
        (project/"demo_server.py").write_text(DEMO_SERVER,encoding="utf-8")
        (project/"sample.jobs.json").write_text(json.dumps(dict(base_url="http://127.0.0.1:8765/api/v1",jobs=[dict(document_id="sample",output="documents/sample.bin")])),encoding="utf-8")
    else:
        sample=project/"sample";sample.mkdir()
        (sample/"sensors.csv").write_text("sensor,gain,offset_c,low_c,high_c\nA,1,0,0,30\n",encoding="utf-8")
        (sample/"readings.csv").write_text("sequence,sensor,temperature,unit\n001,A,20,C\n",encoding="utf-8")
    return dict(case=kind,contract=CONTRACTS[kind])

def grade(kind, project, output):
    output.mkdir(parents=True,exist_ok=True);results=[]
    with tempfile.TemporaryDirectory(prefix="oc-domain-consumer-") as directory:
        root=Path(directory);app=root/"delivered.pyz"
        if (project/"deliverable.pyz").is_file():app.write_bytes((project/"deliverable.pyz").read_bytes())
        fixtures=download_cases() if kind=="download" else temperature_cases()
        for index,fixture in enumerate(fixtures):
            work=root/str(index);work.mkdir();saved=output/str(index);saved.mkdir();row=dict(name=fixture["name"])
            server=None;thread=None;requests=[]
            if kind=="download":
                by_wire={r["wire"]:r for r in fixture["documents"]}
                class Handler(BaseHTTPRequestHandler):
                    def do_GET(self):
                        doc=by_wire.get(self.path);status=200 if doc else 404
                        requests.append(dict(path=self.path,status=status))
                        body=json.dumps(dict(document_id=doc["id"],content_base64=doc["payload"]) if doc else dict(code="UNKNOWN_DOCUMENT"),ensure_ascii=False).encode("utf-8")
                        self.send_response(status);self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
                    def log_message(self,*args):pass
                server=ThreadingHTTPServer(("127.0.0.1",0),Handler);thread=Thread(target=server.serve_forever,daemon=True);thread.start()
                base="http://127.0.0.1:%s/api/v1"%server.server_address[1]
                jobs=dict(base_url=base+("/" if fixture["trailing_slash"] else ""),jobs=[dict(document_id=r["id"],output=r["output"]) for r in fixture["documents"]])
                source=work/"jobs.json";source.write_text(json.dumps(jobs,ensure_ascii=False),encoding="utf-8");(saved/"jobs.json").write_bytes(source.read_bytes())
                target=work/"downloads"
                expected=dict(files=sorted([dict(document_id=r["id"],output=r["output"],url=base.rsplit("/api/v1",1)[0]+r["wire"],bytes=len(base64.b64decode(r["payload"]))) for r in fixture["documents"]],key=lambda r:r["document_id"]))
                row["expected"]=dict(receipt=expected,payloads={r["output"]:r["payload"] for r in fixture["documents"]});row["contract_basis"]="business ID is literal data; independent fixed UTF-8 URL wire paths; output uses native filesystem Path"
            else:
                source=work/"inputs";source.mkdir()
                for name,content in fixture["files"].items():(source/name).write_bytes(content.encode("utf-8"));(saved/name).write_bytes(content.encode("utf-8"))
                target=work/"report.json";row["expected"]=fixture["expected"];row["contract_basis"]="explicit original-unit bounds and Celsius conversion/calibration/threshold facts, independent decimal results"
            argv=[sys.executable,"-I",str(app),str(source),"--output",str(target)];row.update(argv=argv,cwd=str(work))
            try:
                done=subprocess.run(argv,cwd=work,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=45)
                row.update(exit=done.returncode,stdout=done.stdout,stderr=done.stderr)
                if kind=="download":
                    receipt=json.loads((target/"receipt.json").read_text(encoding="utf-8"))
                    payloads={doc["output"]:base64.b64encode((target/doc["output"]).read_bytes()).decode() for doc in fixture["documents"]}
                    wire_ok=all(any(r["path"]==doc["wire"] and r["status"]==200 for r in requests) for doc in fixture["documents"])
                    actual=dict(receipt=receipt,payloads=payloads);row.update(actual=actual,passed=done.returncode==0 and wire_ok and same_value(actual,row["expected"]))
                    for source_file in target.rglob("*"):
                        if source_file.is_file():dest=saved/"downloads"/source_file.relative_to(target);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source_file.read_bytes())
                else:
                    actual=json.loads(target.read_text(encoding="utf-8"));row.update(actual=actual,passed=done.returncode==fixture["exit"] and same_value(actual,fixture["expected"]));(saved/"report.json").write_bytes(target.read_bytes())
            except (OSError,ValueError,KeyError,subprocess.TimeoutExpired) as error:row.update(passed=False,error=str(error))
            finally:
                if server:server.shutdown();server.server_close();thread.join()
            if kind=="download":row["http_requests"]=requests
            results.append(row)
    report=dict(case=kind,passed=all(r["passed"] for r in results),scope="registered contract-derived cases only; no universal support certification",results=results)
    (output/"grade.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    return report

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("action",choices=["setup","grade"]);p.add_argument("kind",choices=CONTRACTS);p.add_argument("project",type=Path);p.add_argument("--output",type=Path);a=p.parse_args()
    result=setup(a.kind,a.project) if a.action=="setup" else grade(a.kind,a.project,a.output)
    print(json.dumps(result,ensure_ascii=True));sys.exit(0 if a.action=="setup" or result["passed"] else 1)
