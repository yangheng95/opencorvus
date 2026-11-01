"""The final pre-candidate consumer is frozen before these four actual full runs."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,sys,zipfile
R=Path(__file__).parent;OUT=R/(sys.argv[1] if len(sys.argv)>1 else 'validation-freeze');OUT.mkdir(exist_ok=False)
cases={'reference':'reference-source','legal-metadata-and-ids':'legal-metadata-and-ids','wrong-commit-on-rollback':'wrong-commit-on-rollback','empty-base':'original-base'}
registration=dict(registered_at=datetime.now(timezone.utc).isoformat(),cases=cases,expected={'reference':0,'legal-metadata-and-ids':0,'wrong-commit-on-rollback':4,'empty-base':4},reason='Final pre-candidate exception-name contract, opaque ids and positive SQLite state/error consumer; original reference unmodified',candidate_started=False,official_score=False)
(OUT/'registration.json').write_text(json.dumps(registration,indent=2),encoding='utf-8')
with zipfile.ZipFile(OUT/'frozen-consumer-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in [R/'consume_native.py',R/'consumer/test_safe_bulk_import.py',R/'prepare_consumer.py',R/'native-consumer-registration.json']:
  z.write(file,file.relative_to(R))
for name,source in cases.items():
 argv=[sys.executable,'-X','utf8','-B',str(R/'consume_native.py'),'--source',str(R/source),'--output',str(OUT/name)]
 start=datetime.now(timezone.utc).isoformat();p=subprocess.run(argv,cwd=R,capture_output=True)
 (OUT/(name+'.stdout.log')).write_bytes(p.stdout);(OUT/(name+'.stderr.log')).write_bytes(p.stderr)
 receipt=dict(argv=argv,started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode,expected=registration['expected'][name])
 (OUT/(name+'.execution.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
