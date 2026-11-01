"""Sensitivity qualification of original model-authored tests, in evaluation copies only."""
import ast
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipapp

root=Path(__file__).resolve().parent
out=root/'before-test-sensitivity';out.mkdir()
reports=[]
for kind,module,method in [('query-export','test_export','ExportTests.test_identifier_value_and_order_boundaries'),('utc-ledger','test_ledger','LedgerTests.test_utc_semantics_and_csv_variations')]:
    original=root/'before'/(kind+'-delivered');project=out/kind;project.mkdir()
    tree=ast.parse((original/'main.py').read_text(encoding='utf-8'));changed=0
    if kind=='query-export':
        for node in tree.body:
            if isinstance(node,ast.FunctionDef) and node.name=='quote_identifier':
                node.body=[ast.Return(value=ast.Name(id=node.args.args[0].arg,ctx=ast.Load()))];changed+=1
        fault='Return raw SQL identifiers, preserving all other behavior'
    else:
        class NaiveOffset(ast.NodeTransformer):
            def visit_Call(self,node):
                global changed
                self.generic_visit(node)
                if isinstance(node.func,ast.Attribute) and node.func.attr=='astimezone':
                    assert len(node.args)==1
                    node.func.attr='replace';node.keywords=[ast.keyword(arg='tzinfo',value=node.args[0])];node.args=[];changed+=1
                return node
        tree=NaiveOffset().visit(tree);fault='Relabel local clock as UTC instead of converting the instant'
    assert changed==1
    source=ast.unparse(ast.fix_missing_locations(tree))+'\n'
    code=project/'evaluation-source';code.mkdir();(code/'__main__.py').write_text(source,encoding='utf-8');zipapp.create_archive(code,project/'deliverable.pyz')
    shutil.copyfile(original/(module+'.py'),project/(module+'.py'))
    argv=[sys.executable,'-B','-m','unittest','-v',module+'.'+method]
    p=subprocess.run(argv,cwd=project,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
    reports.append(dict(kind=kind,source=str(original),fault=fault,changedNodes=changed,testBytesEqual=(project/(module+'.py')).read_bytes()==(original/(module+'.py')).read_bytes(),argv=argv,cwd=str(project),exit=p.returncode,stdout=p.stdout,stderr=p.stderr,scope='Root executed an evaluation fault copy using unchanged producer tests; original model execution is separately bound by its original tool receipt'))
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(kind=r['kind'],exit=r['exit'],diagnostic=r['stderr'][-650:]) for r in reports],ensure_ascii=True,indent=2))
