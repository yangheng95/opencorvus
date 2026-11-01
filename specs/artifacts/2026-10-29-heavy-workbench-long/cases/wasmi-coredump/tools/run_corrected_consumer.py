"""Correct the observed consumer-only public error-module lookup; preserve first compile."""
from pathlib import Path
from datetime import datetime,timezone
import json,os,subprocess,shutil,zipfile
R=Path(__file__).parent;P=R/'consumer';src=R/'reference-source'
current=P/'coredump_contract.rs';target=src/'crates/wasmi/tests/benchmark_coredump_contract.rs'
if target.read_bytes()!=current.read_bytes():raise RuntimeError('Unreviewed change in owned injected consumer')
for p in [current,R/'prepare_consumer.py']:
    text=p.read_text(encoding='utf-8');count=text.count('wasmi::ErrorKind::')
    if count!=4:raise RuntimeError('Public error-module references changed')
    text=text.replace('wasmi::ErrorKind::','wasmi::errors::ErrorKind::')
    text=text.replace('    for frame in frames {\n    }\n','')
    p.write_text(text,encoding='utf-8')
record=json.loads((P/'registration.json').read_text(encoding='utf-8'))
record['first_compile_outcome']=dict(native_exit=101,functions_executed=0,root_cause='Root consumer guessed wasmi::ErrorKind; original public lib.rs exposes wasmi::errors::ErrorKind. Four E0433 errors are one module-path mistake, not four VM defects.',correction='Only correct public error-module path; remove two empty loops left by deletion of redundant absence assertions. Original implementation and all fixed inputs/expected states unchanged.')
record['corrected_at']=datetime.now(timezone.utc).isoformat();(P/'registration.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
with zipfile.ZipFile(R/'corrected-consumer-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in [current,P/'registration.json',R/'prepare_consumer.py']:z.write(p,p.name)
shutil.copyfile(current,target)
out=R/'reference-consumption-corrected';out.mkdir(exist_ok=False)
env=dict(os.environ,CARGO_HOME=str(R/'runtime/cargo-home'),CARGO_TARGET_DIR=str(R/'private-build/reference'),CARGO_TERM_COLOR='never',WASMI_DUMP_OUTPUT=str(out/'actual-dumps'))
argv=['C:/Users/hengu/.cargo/bin/cargo.exe','test','--locked','-p','wasmi','--test','benchmark_coredump_contract','--features','portable-dispatch','--','--test-threads=1','--nocapture']
receipt=dict(started_at=datetime.now(timezone.utc).isoformat(),argv=argv,cwd=str(src),reference_implementation_modified=False,scope='Same original actual acceptance after correcting root consumer tool failure; no model/candidate or new author algorithm')
with (out/'stdout.log').open('wb') as stdout,(out/'stderr.log').open('wb') as stderr:p=subprocess.run(argv,cwd=src,env=env,stdout=stdout,stderr=stderr)
receipt.update(ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode);(out/'execution.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
