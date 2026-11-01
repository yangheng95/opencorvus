import csv,json,pathlib,subprocess,sys
p=pathlib.Path(sys.argv[1]).resolve()
r=subprocess.run([sys.executable,str(p/"sales_summary.py"),str(p/"orders.csv")],capture_output=True,text=True,encoding="utf-8",check=True,cwd=p)
expected={"North/CNY":"25.29","North/USD":"-1.25","South/CNY":"44.00","South/USD":"0.30"}
actual=json.loads(r.stdout)
assert actual==expected,(actual,expected)
with (p/"summary.csv").open(encoding="utf-8-sig",newline="") as f:
 rows=list(csv.DictReader(f))
assert rows==[{"team":k.split("/")[0],"currency":k.split("/")[1],"net_amount":v} for k,v in sorted(expected.items())],rows
report=(p/"REPORT.md").read_text(encoding="utf-8")
assert all(value in report for value in expected.values())
print(json.dumps({"ok":True,"actual":actual,"csv_rows":rows,"report_chars":len(report)},ensure_ascii=False))
