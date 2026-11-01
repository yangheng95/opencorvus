import argparse,csv,json
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
