"""Qualify after-run producer tests using one semantic-fault evaluation copy each."""
import ast
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipapp

root=Path(__file__).resolve().parent;out=root/'after-test-sensitivity';out.mkdir()
cases=[('query-export','test_export','ExportContractTests.test_identifiers_values_order_and_types'),('utc-ledger','test_ledger','LedgerTests.test_offsets_rollovers_and_whole_session_grouping'),('bundle','test_delivery','DeliveryTests.test_native_source_separators')]
reports=[]
for kind,module,method in cases:
    original=root/'after'/(kind+'-delivered');project=out/kind;project.mkdir()
    tree=ast.parse((original/'main.py').read_text(encoding='utf-8'));changed=0
    if kind=='query-export':
        functions=[n for n in tree.body if isinstance(n,ast.FunctionDef)]
        for node in functions:
            if 'identifier' in node.name:
                node.body=[ast.Return(value=ast.Name(id=node.args.args[0].arg,ctx=ast.Load()))];changed+=1
        fault='Return unquoted SQL identifiers; all other logic retained'
    elif kind=='utc-ledger':
        class NaiveOffset(ast.NodeTransformer):
            def visit_Call(self,node):
                global changed
                self.generic_visit(node)
                if isinstance(node.func,ast.Attribute) and node.func.attr=='astimezone':
                    assert len(node.args)==1
                    node.func.attr='replace';node.keywords=[ast.keyword(arg='tzinfo',value=node.args[0])];node.args=[];changed+=1
                return node
        tree=NaiveOffset().visit(tree);fault='Relabel local clock as UTC rather than converting'
    else:
        for node in tree.body:
            if isinstance(node,ast.FunctionDef) and node.name=='source_path':
                guard=ast.If(test=ast.BoolOp(op=ast.And(),values=[ast.Call(func=ast.Name(id='isinstance',ctx=ast.Load()),args=[ast.Name(id='value',ctx=ast.Load()),ast.Name(id='str',ctx=ast.Load())],keywords=[]),ast.Compare(left=ast.Constant(value='\\'),ops=[ast.In()],comparators=[ast.Name(id='value',ctx=ast.Load())])]),body=[ast.Raise(exc=ast.Call(func=ast.Name(id='ValueError',ctx=ast.Load()),args=[ast.Constant(value='evaluation-only native source rejection')],keywords=[]),cause=None)],orelse=[])
                node.body.insert(1,guard);changed+=1
        fault='Reject legal backslash source values, preserving ZIP target rules'
    assert changed==1,(kind,changed)
    code=project/'evaluation-source';code.mkdir();(code/'__main__.py').write_text(ast.unparse(ast.fix_missing_locations(tree))+'\n',encoding='utf-8');zipapp.create_archive(code,project/'deliverable.pyz')
    shutil.copyfile(original/(module+'.py'),project/(module+'.py'))
    argv=[sys.executable,'-B','-m','unittest','-v',module+'.'+method]
    p=subprocess.run(argv,cwd=project,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
    reports.append(dict(kind=kind,fault=fault,changedNodes=changed,testBytesEqual=(project/(module+'.py')).read_bytes()==(original/(module+'.py')).read_bytes(),argv=argv,cwd=str(project),exit=p.returncode,stdout=p.stdout,stderr=p.stderr,scope='Root sensitivity qualification only; original successful model execution remains its own original Tool receipt'))
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(kind=r['kind'],exit=r['exit'],diagnostic=r['stderr'][-500:]) for r in reports],ensure_ascii=True,indent=2))
