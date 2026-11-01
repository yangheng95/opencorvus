"""Positive final-program consumers, including real loopback HTTP requests."""
from pathlib import Path
import tempfile
import unittest
import zipapp

from delivery_domain_cases import PROTOTYPES, grade, temperature_cases

CORRECT = {
    "download": '''import argparse,base64,json
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();cfg=json.loads(Path(a.input).read_text(encoding="utf-8"));root=Path(a.output);root.mkdir(parents=True,exist_ok=True);files=[]
for job in cfg["jobs"]:
    url=cfg["base_url"].rstrip("/")+"/documents/"+quote(job["document_id"],safe="")
    with urlopen(url) as response:data=json.load(response)
    raw=base64.b64decode(data["content_base64"]);target=root/job["output"];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    files.append(dict(document_id=job["document_id"],output=job["output"],url=url,bytes=len(raw)))
(root/"receipt.json").write_text(json.dumps(dict(files=sorted(files,key=lambda r:r["document_id"])),ensure_ascii=False),encoding="utf-8")
''',
    "temperature": '''import argparse,csv,json
from decimal import Decimal as D
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input)
def rows(name):
    with open(root/name,encoding="utf-8",newline="") as f:return list(csv.DictReader(f))
sensors={r["sensor"]:r for r in rows("sensors.csv")};output=[];counts=dict(LOW=0,OK=0,HIGH=0);report=None
for row in rows("readings.csv"):
    value=D(row["temperature"]);unit=row["unit"]
    if value < {"C":D("-273.15"),"F":D("-459.67"),"K":D(0)}[unit]:report=dict(success=False,error=dict(code="BELOW_ABSOLUTE_ZERO",sequence=row["sequence"],sensor=row["sensor"]));break
    c=value if unit=="C" else (value-D(32))*D(5)/D(9) if unit=="F" else value-D("273.15")
    sensor=sensors[row["sensor"]];cal=c*D(sensor["gain"])+D(sensor["offset_c"])
    status="LOW" if cal<D(sensor["low_c"]) else "HIGH" if cal>D(sensor["high_c"]) else "OK";counts[status]+=1
    output.append(dict(sequence=row["sequence"],sensor=row["sensor"],celsius=float(c),calibrated_c=float(cal),status=status))
if report is None:report=dict(success=True,readings=output,counts=counts)
Path(a.output).write_text(json.dumps(report,ensure_ascii=False),encoding="utf-8");raise SystemExit(0 if report["success"] else 2)
''',
}

def validate(output):
    reports={}
    for kind in ["download","temperature"]:
        for variant,source in [("correct",CORRECT[kind]),("original-prototype",PROTOTYPES[kind])]:
            project=output/(kind+"-"+variant);code=project/"source";code.mkdir(parents=True)
            (code/"__main__.py").write_text(source,encoding="utf-8");zipapp.create_archive(code,project/"deliverable.pyz")
            reports[kind+"/"+variant]=grade(kind,project,project/"consumer")
    return reports

class DomainConsumerTest(unittest.TestCase):
    def test_known_physical_equivalences_and_calibration_results(self):
        fixtures=temperature_cases()
        self.assertEqual([r["celsius"] for r in fixtures[0]["expected"]["readings"]],[-40,-40,-40])
        self.assertEqual([r["calibrated_c"] for r in fixtures[1]["expected"]["readings"]],[40,-10,0])
        self.assertEqual(fixtures[3]["expected"],dict(success=False,error=dict(code="BELOW_ABSOLUTE_ZERO",sequence="bad",sensor="edge")))

    def test_actual_http_files_and_temperature_cli_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            reports=validate(Path(directory))
            self.assertEqual({k:v["passed"] for k,v in reports.items()},{"download/correct":True,"download/original-prototype":False,"temperature/correct":True,"temperature/original-prototype":False})
            self.assertEqual(reports["download/correct"]["results"][0]["http_requests"],[dict(path="/api/v1/documents/part%2Fone",status=200),dict(path="/api/v1/documents/%252F",status=200)])
            self.assertEqual(reports["temperature/correct"]["results"][3]["exit"],2)

if __name__=="__main__":
    import argparse,json
    p=argparse.ArgumentParser();p.add_argument("--output",type=Path);a=p.parse_args()
    if a.output:
        reports=validate(a.output);print(json.dumps({k:v["passed"] for k,v in reports.items()}))
        raise SystemExit(0 if [r["passed"] for r in reports.values()]==[True,False,True,False] else 1)
    unittest.main(argv=[__file__])
