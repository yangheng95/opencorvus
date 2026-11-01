"""Execute the registered whole-task positive consumer against untouched original implementation."""
from pathlib import Path
from datetime import datetime,timezone
import json,os,subprocess,shutil,zipfile,difflib
R=Path(__file__).parent;P=R/'consumer';source=R/'reference-source'
builder=R/'prepare_consumer.py';text=builder.read_text(encoding='utf-8');lines=text.splitlines();indices=[i for i,x in enumerate(lines) if x.startswith('    let module = Module::new(&engine, "(module')]
if len(indices)!=1:raise RuntimeError('Precise builder quote location changed')
lines[indices[0]]='    let module = Module::new(&engine, r#"(module (func (export "trap") unreachable))"#).unwrap();'
builder.write_text('\n'.join(lines)+'\n',encoding='utf-8')
patch=(R/'original-task/tests/test.patch').read_text(encoding='utf-8');part=patch.split('@@ -0,0 +1,1016 @@\n',1)[1].split('diff --git a/test.sh',1)[0]
original='\n'.join(x[1:] for x in part.splitlines() if x.startswith('+'))+'\n';current=(P/'coredump_contract.rs').read_text(encoding='utf-8')
(P/'adaptation.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),current.splitlines(True),fromfile='original-private-coredump.rs',tofile='current-positive-coredump-contract.rs')),encoding='utf-8')
registered=json.loads((P/'registration.json').read_text(encoding='utf-8'));registered['pre_execution_quote_correction']='Generated Rust WAT literal escaping fixed before the first compile; pre-fix source retained. A precise patch context miss was an unexecuted root tool issue.'
(P/'registration.json').write_text(json.dumps(registered,indent=2),encoding='utf-8')
with zipfile.ZipFile(R/'first-consumer-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in [P/'coredump_contract.rs',P/'registration.json',P/'adaptation.diff',builder]:z.write(p,p.name)
target=source/'crates/wasmi/tests/benchmark_coredump_contract.rs'
if target.exists():raise RuntimeError('Original reference consumer already materialized')
shutil.copyfile(P/'coredump_contract.rs',target)
out=R/'reference-consumption';out.mkdir(exist_ok=False)
env=dict(os.environ,CARGO_HOME=str(R/'runtime/cargo-home'),CARGO_TARGET_DIR=str(R/'private-build/reference'),CARGO_TERM_COLOR='never',WASMI_DUMP_OUTPUT=str(out/'actual-dumps'))
argv=['C:/Users/hengu/.cargo/bin/cargo.exe','test','--locked','-p','wasmi','--test','benchmark_coredump_contract','--features','portable-dispatch','--','--test-threads=1','--nocapture']
receipt=dict(started_at=datetime.now(timezone.utc).isoformat(),argv=argv,cwd=str(source),declared_env={k:env[k] for k in ['CARGO_HOME','CARGO_TARGET_DIR','CARGO_TERM_COLOR','WASMI_DUMP_OUTPUT']},reference_implementation_modified=False,scope='Original implementation plus the separately registered external consumer only; first actual feature execution, not a model result or official score')
(out/'started.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
with (out/'stdout.log').open('wb') as stdout,(out/'stderr.log').open('wb') as stderr:p=subprocess.run(argv,cwd=source,env=env,stdout=stdout,stderr=stderr)
receipt.update(ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode)
(out/'execution.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
