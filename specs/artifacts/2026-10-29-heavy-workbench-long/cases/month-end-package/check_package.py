"""Actual indexed CFO-workbook consumption against independent public sources.

The index locates actual cells; it never supplies expected amounts. Saved values
and a real workbook engine are measured. Professional/visual review is separate.
"""
import argparse
import ast
from datetime import datetime, date
from decimal import Decimal
import json
from pathlib import Path
import subprocess
import unicodedata
import openpyxl
from openpyxl.utils import column_index_from_string
from openpyxl.utils.datetime import to_excel
D = lambda x: Decimal(str(x))


def original_accounts(public):
    result = {}
    for raw in (public / "Aurisic_Final_TB_4-25-1.txt").read_text().splitlines():
        fields = raw.rsplit(None, 3)
        if len(fields) != 4: continue
        identity = fields[0].split(None, 1)
        pair = identity[0].split("-")
        if len(identity) != 2 or len(pair) != 2 or any(len(x) != 4 or not x.isdigit() for x in pair): continue
        def money(text): return D(text.rstrip("-")) * (-1 if text.endswith("-") else 1)
        result[tuple(map(int,pair))] = dict(name=identity[1],period=money(fields[1]),ytd=money(fields[2]),**{"class":fields[3]})
    return result


def expectations(public, source_calculations):
    ledger = original_accounts(public)
    oracle = json.loads(source_calculations.read_text(encoding="utf-8"))
    observed = {(r["file"],r["sheet"]):r for r in oracle["results"]}
    if any(r["source_errors"] for r in observed.values()): raise ValueError("SOURCE_CALCULATION_ERROR")
    books = {}
    def source(file,sheet=0):
        if file not in books: books[file]=openpyxl.load_workbook(public/file,data_only=False)
        return books[file].worksheets[sheet]
    def literal(file,cell):
        x=source(file)[cell].value
        if x is None: return D(0)  # Genuinely empty source summand only.
        if not isinstance(x,(int,float)): raise ValueError(f"SOURCE_NUMERIC_LITERAL_REQUIRED:{file}:{cell}")
        return D(x)
    def calc(file,cell):
        value=observed[(file,source(file).title)]["values"][cell]
        return D(value) if value is not None else None
    def constant_formula(file,cell):
        # These source salary cells are arithmetic constants, not literal
        # amounts. Evaluate their original expressions with Decimal arithmetic.
        text=source(file)[cell].value
        def number(node):
            if isinstance(node,ast.Constant) and isinstance(node.value,(int,float)):return D(node.value)
            if isinstance(node,ast.BinOp):
                a,b=number(node.left),number(node.right)
                if isinstance(node.op,ast.Add):return a+b
                if isinstance(node.op,ast.Sub):return a-b
                if isinstance(node.op,ast.Mult):return a*b
                if isinstance(node.op,ast.Div):return a/b
            raise ValueError(f"SOURCE_CONSTANT_EXPRESSION_REQUIRED:{file}:{cell}")
        return number(ast.parse(text.removeprefix("="),mode="eval").body)
    def total(file,col,first,last): return sum((literal(file,f"{col}{r}") for r in range(first,last+1)),D(0))
    y=lambda account,div=10:ledger[(div,account)]["ytd"]
    m=lambda account:ledger[(10,account)]["period"]
    wanted={}
    def group(prefix,**values): wanted.update({f"{prefix}.{key}":value for key,value in values.items()})
    cash=y(1023)+y(1024)
    inter=sum((y(x) for x in [1651,1652,1653,1654,1656,1663,1664]),D(0))
    group("cash",borrowing=-y(2600),intercompany=inter,unused=-y(2600)-inter,balance=cash,excess=cash+y(2600)+inter)
    checks=total("Outstanding_CKs_4-30-25-1.xlsx","B",7,8)
    group("bank",checks=checks,book=cash)
    wanted["bank.reclass"]=checks  # Source C14=SUM(B10), still only proposed.
    group("funding",funding=-y(7206),funding_average=-y(7206)/4,intercompany=-y(7075),intercompany_average=-y(7075)/4,
          bank_other=-y(7076)-y(7092),bank_other_average=(-y(7076)-y(7092))/4,
          total=-sum((r["ytd"] for r in ledger.values() if r["class"]=="i"),D(0)))
    wanted["funding.total_average"]=wanted["funding.total"]/4
    for kind,file,col,first,last,account in [("expense","PPD1250-1.xlsx","BX",8,45,1250),("insurance","PPD1251-1.xlsx","AT",6,31,1251)]:
        values={r:calc(file,f"{col}{r}") for r in range(first,last+1) if calc(file,f"{col}{r}") is not None}
        wanted.update({f"prepaid.{kind}.vendor.{r}":v for r,v in values.items()})
        group(f"prepaid.{kind}",total=sum(values.values(),D(0)),gl=y(account),gap=y(account)-sum(values.values(),D(0)))
    wanted["prepaid.expense.amortization25"]=literal("PPD1250-1.xlsx","BV25")/6
    wanted["fees.balance"]=total("Prof_Fee_Dump-1.xlsx","V",4,8)+total("Prof_Fee_Dump-1.xlsx","W",3,8)
    legal=total("Legal_Dump-1.xlsx","L",3,59)+total("Legal_Dump-1.xlsx","M",3,59)
    headings={c.value:c.column_letter for c in source("Legal_Dump-1.xlsx")[2] if c.value}
    april=sum((literal("Legal_Dump-1.xlsx",f"{headings[field]}{r}") for r in range(3,60)
               if source("Legal_Dump-1.xlsx")[f"{headings['Period']}{r}"].value==425 for field in ["Debit","Credit"]),D(0))
    group("legal",total=legal,gl=y(6200),gap=y(6200)-legal,april=april)
    for n,file,row in [(1,"Good Insurance Co - Loan.xlsx",74),(2,"Good Insurance Co - Loan II.xlsx",24)]:
        group(f"loan{n}",principal=calc(file,f"G{row}"),charge=calc(file,f"E{row}"),interest=calc(file,f"F{row}"))
    interest=wanted["loan1.interest"]+wanted["loan2.interest"]
    principal=wanted["loan1.principal"]+wanted["loan2.principal"]
    group("loans",interest=interest,interest_gl=-y(2402),interest_gap=-y(2402)-interest,principal=principal,
          principal_gl=-y(2600)-y(2601),principal_gap=-y(2600)-y(2601)-principal)
    wanted["ap.control"]=-y(2000)
    ar=literal("AR_Accrual-1.xlsx","B4")
    group("ar",source=ar,division10=y(1101),gap=y(1101)-ar,division12=y(1101,12))
    march=openpyxl.load_workbook(public/"Aurisic_Financials_3-25-1.xlsx",data_only=True).worksheets[1]
    prior={(int(r[0]),int(r[1])):D(r[4]) for r in march.values if len(r)>4 and isinstance(r[0],(int,float)) and isinstance(r[1],(int,float))}
    p=lambda cell:literal("Payroll-1.xlsx",cell)
    posts=p("C25")+p("C28")+p("C32")
    salary=constant_formula("Payroll-1.xlsx","C6")+constant_formula("Payroll-1.xlsx","D6")-posts
    expenses=p("C18")+p("D18")
    group("payroll",first=calc("Payroll-1.xlsx","C21"),second=calc("Payroll-1.xlsx","D21"),estimate=calc("Payroll-1.xlsx","E29"),
          opening=prior[(10,2200)],postings=posts,rollforward=prior[(10,2200)]+posts,gl=y(2200),gap=y(2200)-prior[(10,2200)]-posts,
          salary=salary,salary_gl=m(6000),salary_gap=m(6000)-salary,expenses=expenses,expenses_gl=m(6305),expenses_gap=m(6305)-expenses)
    for name,value,account,sign in [
        ("rebates",total("Rebates-1.xlsx","B",4,10),2005,-1),
        ("uninvoiced",total("Accr2011-1.xlsx","B",4,5),2011,1),
        ("bonus",total("AccrBonus-1.xlsx","B",5,12),2401,1),
        ("misc",literal("AccrMisc-1.xlsx","C4")+calc("AccrMisc-1.xlsx","B5")+total("AccrMisc-1.xlsx","B",6,9),2410,1)]:
        group(name,total=value,gl=-y(account),gap=sign*(-y(account)-value))
    group("bonus",headline=wanted["bonus.total"],salary_ytd=y(6000),ten_percent_reference=y(6000)/10,
          source_salary=literal("AccrBonus-1.xlsx","B18"),source_reported=literal("AccrBonus-1.xlsx","B15"))
    for period in ["period","ytd"]:
        for name,codes in [("net",["i","e"]),("clearing",["c"]),("proof",["a","l","i","e","c"])]:
            wanted[f"tb.{name}.{period}"]=sum((r[period] for r in ledger.values() if r["class"] in codes),D(0))
    bridges={key:dict(prior=prior[key],movement=r["period"],current=r["ytd"],gap=r["ytd"]-prior[key]-r["period"])
             for key,r in ledger.items() if key in prior and abs(r["ytd"]-prior[key]-r["period"])>D(".011")}
    loan_delta=float(-wanted["loan1.principal"]*D(".01")*30/365)
    refresh=[
        dict(input="input.cash1024",delta=1,outputs={"cash.balance":1,"bank.book":1}),
        dict(input="input.bonus",delta=100,outputs={"bonus.total":100,"bonus.headline":100,"bonus.gap":-100,"bonus.source_reported":0}),
        dict(input="input.prepaid_addition",delta=6,outputs={"prepaid.expense.amortization25":1,"prepaid.expense.vendor.25":5,"prepaid.expense.total":5,"prepaid.expense.gap":-5}),
        dict(input="input.fees",delta=1,outputs={"fees.balance":1}),
        dict(input="input.check",delta=1,outputs={"bank.checks":1}),
        dict(input="input.loan1_rate",delta=-1,outputs={"loan1.charge":loan_delta,"loan1.interest":loan_delta,"loans.interest":loan_delta})]
    return ledger,wanted,bridges,refresh,source


def normalized(x):
    return " ".join(unicodedata.normalize("NFKC",str(x or "")).split()).casefold()


def measure(args):
    ledger,wanted,bridges,refresh,source=expectations(args.public,args.source_calculations)
    book=openpyxl.load_workbook(args.workbook,data_only=True)
    index={}
    errors=[]
    def error(code,**detail): errors.append(dict(contract=code,**detail))
    fields=["Claim","Sheet","Address","Role","Columns","Basis"]
    for sheet in book:
        for row in sheet.iter_rows(max_row=min(sheet.max_row,25)):
            labels=[str(c.value or "").strip() for c in row]
            if not all(f in labels for f in fields): continue
            positions={f:labels.index(f) for f in fields}
            for vals in sheet.iter_rows(min_row=row[0].row+1,values_only=True):
                claim=vals[positions["Claim"]]
                if not claim: continue
                if claim in index: error("CLAIM_ID_DUPLICATE",claim=claim)
                e={f.lower():vals[positions[f]] for f in fields}
                e["columns"]=json.loads(e["columns"] or "{}")
                index[claim]=e
    if not index: error("EVIDENCE_INDEX_REQUIRED")
    args.output.parent.mkdir(parents=True,exist_ok=True)
    spec=args.output.with_suffix(".consumer-input.json")
    observed=args.output.with_suffix(".engine.json")
    spec.write_text(json.dumps(dict(index=index,scalar_claims=list(wanted),refresh=refresh),indent=2),encoding="utf-8")
    child=subprocess.run([str(args.node),str(Path(__file__).with_name("consume_package.mjs")),str(args.workbook),str(spec),str(observed)],capture_output=True,text=True,encoding="utf-8")
    args.output.with_suffix(".engine.stdout.log").write_text(child.stdout,encoding="utf-8")
    args.output.with_suffix(".engine.stderr.log").write_text(child.stderr,encoding="utf-8")
    engine=json.loads(observed.read_text(encoding="utf-8")) if observed.exists() else None
    if child.returncode or engine is None:
        error("WORKBOOK_ENGINE_CONSUMPTION_ERROR",native_exit=child.returncode,detail=child.stderr[-2000:])
        return dict(measured_contracts_match=None,errors=errors,ledger_accounts=None,numeric_claims=len(wanted),source_inputs_checked=None,
                    engine_native_exit=child.returncode,refresh=None,score=None,
                    scope="Engine consumption unavailable; financial correctness is unmeasured. Distinguish unsupported facility formulas from malformed candidate locators using the retained engine error. Do not count missing engine observations as financial amount errors.")
    def entry(claim):
        if claim not in index: error("CLAIM_REQUIRED",claim=claim);return None
        e=index[claim]
        if e["sheet"] not in book.sheetnames:error("CLAIM_SHEET_REQUIRED",claim=claim);return None
        return e
    def scalar(claim):
        e=entry(claim)
        if not e:return None
        return engine["baseline"].get(claim) if engine else None
    def match(claim,actual,expected,tolerance=D(".0050001")):
        ok=isinstance(actual,(int,float,Decimal)) and abs(D(actual)-D(expected))<=tolerance
        if not ok:error("AMOUNT_MISMATCH",claim=claim,expected=str(expected),actual=actual)
        return ok
    def table(claim):
        e=entry(claim)
        if not e:return []
        return engine["tables"].get(claim,[]) if engine else []
    actual_ledger={}
    for r in table("ledger"):
        try:key=(int(r["division"]),int(r["account"]))
        except (TypeError,ValueError,KeyError):error("ACCOUNT_ID_REQUIRED",actual=r);continue
        if key in actual_ledger:error("ACCOUNT_DUPLICATE",account=key)
        actual_ledger[key]=r
    for key,w in ledger.items():
        r=actual_ledger.get(key)
        if not r:error("ACCOUNT_REQUIRED",account=key);continue
        for field in ["period","ytd"]:match(f"ledger.{key}.{field}",r.get(field),w[field],D(".0000001"))
        for field in ["name","class"]:
            if normalized(r.get(field))!=normalized(w[field]):error("ACCOUNT_METADATA_MISMATCH",account=key,field=field,expected=w[field],actual=r.get(field))
    for key in actual_ledger.keys()-ledger.keys():error("ACCOUNT_UNEXPECTED",account=key)
    # A liability balance can be shown as a signed ledger amount or as an
    # explicitly labelled positive credit balance. Normalize the WHOLE coupled
    # control group, never an individual absolute value or a nearest-fit amount.
    controls=['payroll.opening','payroll.rollforward','payroll.gl','payroll.gap']
    raw_controls={claim:scalar(claim) for claim in controls}
    def fits(multiplier):
        return all(isinstance(raw_controls[k],(int,float)) and D(raw_controls[k]).is_finite()
                   and abs(D(raw_controls[k])*multiplier-wanted[k])<=D('.0050001') for k in controls)
    basis='ledger_signed' if fits(1) else 'credit_positive' if fits(-1) else 'inconsistent'
    if basis=='inconsistent':
        error('ACCOUNTING_BASIS_INCONSISTENT',group='payroll_liability_controls',actual=raw_controls,
              ledger_signed_expected={k:str(wanted[k]) for k in controls},
              credit_positive_expected={k:str(-wanted[k]) for k in controls})
    for claim,w in wanted.items():
        if claim in controls:
            if basis!='inconsistent':match(claim,D(raw_controls[claim])*(-1 if basis=='credit_positive' else 1),w)
        else:match(claim,scalar(claim),w)
    for claim in ["bank.statement","bank.reconciliation","ap.detail"]:
        e=entry(claim);v=scalar(claim)
        if e and (e["role"]!="unavailable" or isinstance(v,(int,float))):error("MISSING_SOURCE_STATUS_REQUIRED",claim=claim,actual=v)
    for claim in ["ar.mapping","payroll.annotation","ap.action"]:
        e=entry(claim);v=scalar(claim)
        if e and (e["role"]!="explanation" or not isinstance(v,str) or not v.strip()):error("SOURCE_EXPLANATION_REQUIRED",claim=claim)
    actual_bridges={}
    for r in table("bridges"):
        try:key=(int(r["division"]),int(r["account"]))
        except (TypeError,ValueError,KeyError):error("BRIDGE_ID_REQUIRED",actual=r);continue
        actual_bridges[key]=r
    for key,w in bridges.items():
        if key not in actual_bridges:error("CROSS_PERIOD_BRIDGE_REQUIRED",account=key);continue
        for field,value in w.items():match(f"bridge.{key}.{field}",actual_bridges[key].get(field),value)
    inputs_checked=0
    for id,file,first,last,endcol in [
        ("legal","Legal_Dump-1.xlsx",3,59,13),("fees","Prof_Fee_Dump-1.xlsx",3,8,23),
        ("loan1","Good Insurance Co - Loan.xlsx",11,74,5),("loan2","Good Insurance Co - Loan II.xlsx",11,24,5),
        ("payroll","Payroll-1.xlsx",5,20,4),("checks","Outstanding_CKs_4-30-25-1.xlsx",7,8,5),
        ("prepaid_expense","PPD1250-1.xlsx",8,45,82),("prepaid_insurance","PPD1251-1.xlsx",6,31,48)]:
        rows={}
        for r in table(f"source.{id}"):
            try:key=int(r["source_row"])
            except (KeyError,TypeError,ValueError):error("SOURCE_ROW_ID_REQUIRED",source=id);continue
            if key in rows:error("SOURCE_ROW_DUPLICATE",source=id,row=key)
            rows[key]=r
        for row in source(file).iter_rows(min_row=first,max_row=last,max_col=endcol):
            for cell in row:
                w=cell.value
                if w is None or cell.data_type in ("f","e"):continue
                v=rows.get(cell.row,{}).get(cell.column_letter)
                if isinstance(w,bool):ok=v==w
                elif isinstance(w,(int,float)):ok=isinstance(v,(int,float)) and abs(D(v)-D(w))<=D(".0000001")
                elif isinstance(w,(date,datetime)):
                    ok=(isinstance(v,(int,float)) and abs(D(v)-D(to_excel(w)))<=D(".0000001")) or (isinstance(v,str) and v[:10]==w.isoformat()[:10])
                else:ok=normalized(w)==normalized(v)
                if not ok:error("SOURCE_INPUT_MISMATCH",source=file,cell=cell.coordinate,expected=str(w),actual=str(v))
                inputs_checked+=1
    for claim in ["issues","contents"]:
        if not table(claim):error("HANDOFF_TABLE_REQUIRED",claim=claim)
    if engine:
        for run in engine["refresh"]:
            for claim,w in run["expected"].items():match(f"refresh.{run['input']}.{claim}",run["deltas"].get(claim),w,D(".00001"))
            for claim,v in run["unavailable"].items():
                if isinstance(v,(int,float)):error("INDEPENDENT_SOURCE_STILL_REQUIRED",claim=claim,actual=v)
    if child.returncode:error("WORKBOOK_ENGINE_CONSUMPTION_ERROR",native_exit=child.returncode,detail=child.stderr[-2000:])
    return dict(measured_contracts_match=not errors,errors=errors,ledger_accounts=len(actual_ledger),numeric_claims=len(wanted),source_inputs_checked=inputs_checked,
                accounting_basis=dict(payroll_liability_controls=basis,raw_observations=raw_controls,semantic_label_review_required=True,
                                      scope='Coupled quantity consistency only; actual labels and formulas must establish the claimed accounting meaning'),
                engine_native_exit=child.returncode,refresh=engine["refresh"] if engine else None,score=None,
                saved_cache_observations={claim:[book[e['sheet']][c.strip()].value for c in e['address'].split(',')] for claim,e in index.items() if claim in wanted},
                scope="Indexed actual-XLSX recalculated data and declared dependency contracts only. Saved caches are observations, not the truth or a gate. Free-text meaning, company policy, visual usability and complete handoff require separate whole-product review. Not an official GDPval score, company sign-off or general Excel-engine certification.")


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    for name in ["public","workbook","source-calculations","output","node"]:p.add_argument("--"+name,type=Path,required=True)
    args=p.parse_args()
    result=measure(args)
    args.output.write_text(json.dumps(result,indent=2,default=str),encoding="utf-8")
    print(json.dumps({k:result[k] for k in ["measured_contracts_match","ledger_accounts","numeric_claims","source_inputs_checked","engine_native_exit"]}|{"errors":len(result["errors"]),"score":None}))
    raise SystemExit(3 if result["measured_contracts_match"] is None else 0 if result["measured_contracts_match"] else 4)
