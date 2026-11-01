import argparse,csv,json
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
