"""Independent actual-XLSX measurements from original fixed TB text.

Input parsing uses right-delimited source fields, independently of the producer's
regular-expression normalization. No expert workbook, producer JSON, hash gate
or self-reported success is used as the numerical expectation.
"""
import argparse
from decimal import Decimal
import json
from pathlib import Path
import openpyxl


def original_accounts(public):
    result = {}
    for raw in (public / "Aurisic_Final_TB_4-25-1.txt").read_text().splitlines():
        tokens = raw.split()
        if not tokens:
            continue
        key = tokens[0].split("-")
        if len(key) != 2 or any(len(x) != 4 or not x.isdigit() for x in key):
            continue
        fields = raw.rsplit(None, 3)
        def money(text):
            sign = -1 if text[-1] == "-" else 1
            return Decimal(text[:-1] if sign == -1 else text) * sign
        result[tuple(map(int, key))] = [money(fields[1]), money(fields[2])]
    return result


def measure(public, file, source_calculations):
    expected = original_accounts(public)
    book = openpyxl.load_workbook(file, data_only=True)
    tabs = {s.title.split(")", 1)[0].lstrip("#"): s for s in book if s.title.startswith("#")}
    tb = tabs["3a"]
    actual, duplicates, metadata = {}, [], {}
    for row in tb.values:
        if len(row) >= 5 and isinstance(row[0], (int, float)) and isinstance(row[1], (int, float)):
            key = (int(row[0]), int(row[1]))
            if key in actual:
                duplicates.append(key)
            actual[key] = row[3:5]
            metadata[key] = (row[2],row[5])
    differences = []
    for key, amounts in expected.items():
        if key not in actual:
            differences.append({"division": key[0], "account": key[1], "contract": "ACCOUNT_MISSING"})
            continue
        for index, wanted in enumerate(amounts):
            value = actual[key][index]
            error = Decimal(str(value)) - wanted if isinstance(value, (int, float)) else None
            if error is None or abs(error) > Decimal("0.0000001"):
                differences.append({"division": key[0], "account": key[1], "field": ["period", "ytd"][index],
                                    "expected": str(wanted), "actual": value, "signed_error": str(error) if error is not None else None,
                                    "contract": "ACCOUNT_AMOUNT_MISMATCH"})
    extra = [list(k) for k in actual.keys() - expected.keys()]
    for raw in (public / "Aurisic_Final_TB_4-25-1.txt").read_text().splitlines():
        fields=raw.rsplit(None,3)
        if len(fields)!=4:
            continue
        identity=fields[0].split(None,1)
        pair=identity[0].split("-")
        if len(identity)!=2 or len(pair)!=2 or any(not x.isdigit() for x in pair):
            continue
        key=tuple(map(int,pair))
        if key in actual and metadata[key]!=(identity[1],fields[3]):
            differences.append({"division":key[0],"account":key[1],"contract":"ACCOUNT_IDENTITY_METADATA_MISMATCH",
                                "expected":[identity[1],fields[3]],"actual":metadata[key]})
    ytd = lambda account: expected[(10, account)][1]
    cash = ytd(1023) + ytd(1024)
    intercompany = sum(ytd(x) for x in [1651, 1652, 1653, 1654, 1656, 1663, 1664])
    # Identify the template's original borrowing control by its account, not a
    # candidate-selected denominator or the producer's row map.
    march = openpyxl.load_workbook(public / "Aurisic_Financials_3-25-1.xlsx", data_only=True)
    loan_account = int(march.worksheets[1]["B38"].value)
    borrowing = -ytd(loan_account)
    expected_controls = [("B5", borrowing), ("B15", intercompany), ("B17", borrowing-intercompany),
                         ("B19", cash), ("B21", cash-(borrowing-intercompany))]
    controls = []
    for cell, wanted in expected_controls:
        value = tabs["4"][cell].value
        error = Decimal(str(value))-wanted if isinstance(value,(int,float)) else None
        controls.append({"schedule":"4","cell":cell,"expected":str(wanted),"actual":value,
                         "signed_error":str(error) if error is not None else None,
                         "contract":"AMOUNT_MATCH" if error is not None and abs(error)<Decimal("0.0000001") else "CONTROL_AMOUNT_MISMATCH"})
    # This adapter measures the supplied template/reference coordinates. It is
    # not a general grader for every legitimate alternative workbook layout.
    oracle = json.loads(source_calculations.read_text(encoding="utf-8"))
    calculated = {(r["file"], r["sheet"]): r for r in oracle["results"]}
    if any(r["source_errors"] for r in calculated.values()):
        raise ValueError("SOURCE_CALCULATION_ERROR")
    sources = {}
    def source(filename, index=0):
        if filename not in sources:
            sources[filename] = openpyxl.load_workbook(public / filename, data_only=False)
        return sources[filename].worksheets[index]
    def literal(filename, cell, index=0):
        value = source(filename, index)[cell].value
        if value is None:
            return Decimal(0)  # SUM over genuinely empty source cells only.
        if not isinstance(value, (int, float)):
            raise ValueError("SOURCE_LITERAL_REQUIRED:" + filename + ":" + cell)
        return Decimal(str(value))
    def calc(filename, cell, index=0):
        name = source(filename, index).title
        return calculated[(filename, name)]["values"][cell]
    def source_sum(filename, column, start, end):
        return sum((literal(filename, f"{column}{r}") for r in range(start, end+1)), Decimal(0))
    numerical = []
    def compare(dimension, tab, cell, wanted, origin):
        value = tabs[tab][cell].value
        if isinstance(wanted, (Decimal, int, float)):
            error = Decimal(str(value))-Decimal(str(wanted)) if isinstance(value, (int, float)) else None
            match = error is not None and abs(error) <= Decimal("0.0000001")
        else:
            error, match = None, value == wanted
        numerical.append({"dimension":dimension,"schedule":tab,"cell":cell,"source":origin,
                          "expected":str(wanted) if isinstance(wanted, Decimal) else wanted,"actual":value,
                          "signed_error":str(error) if error is not None else None,
                          "contract":"AMOUNT_MATCH" if match else "SOURCE_RESULT_MISMATCH"})
    checks = source_sum("Outstanding_CKs_4-30-25-1.xlsx", "B", 7, 8)
    compare("M03", "5", "B10", checks, "Two original check amounts B7:B8")
    compare("M03", "5", "C4", None, "Original independent bank balance is empty")
    compare("M03", "5", "C12", "unavailable", "Independent reconciliation cannot yet be calculated")
    compare("M03", "5", "C18", cash, "Separate ledger control, not bank evidence")
    funding = -ytd(7206)
    for cell, wanted in [("D12",funding),("E12",funding/4),("D14",-ytd(7075)),("E14",-ytd(7075)/4),
                         ("D15",-ytd(7076)),("E15",-ytd(7076)/4),("D18",-ytd(7092))]:
        compare("M04","6",cell,wanted,"April ledger; four elapsed months; other income separate")
    for filename, tab, column, first, last_row, total, variance, gl_cell, account in [
        ("PPD1250-1.xlsx","7","BX",8,45,46,48,49,1250),
        ("PPD1251-1.xlsx","8","AT",6,31,32,34,35,1251),
    ]:
        expected_total = Decimal(0)
        for row in range(first,last_row+1):
            cell = f"{column}{row}"
            wanted = calc(filename,cell)
            compare("M05",tab,cell,wanted,"Independent formulas engine: original vendor calculation")
            if wanted is not None:
                expected_total += Decimal(str(wanted))
        for cell, wanted in [(f"{column}{total}",expected_total),(f"{column}{variance}",ytd(account)-expected_total),
                             (f"{column}{gl_cell}",ytd(account))]:
            compare("M05",tab,cell,wanted,"Vendor sum / original GL; discrepancy retained")
    fees = source_sum("Prof_Fee_Dump-1.xlsx","V",4,8)+source_sum("Prof_Fee_Dump-1.xlsx","W",3,8)
    legal = source_sum("Legal_Dump-1.xlsx","L",3,59)+source_sum("Legal_Dump-1.xlsx","M",3,59)
    for tab, cell, wanted, origin in [("9","W10",fees,"Signed original professional-fee postings"),
        ("10","L63",legal,"Signed original legal transactions, each once"),("10","L65",ytd(6200),"GL6200"),
        ("10","L66",ytd(6200)-legal,"GL less signed source detail")]: compare("M06",tab,cell,wanted,origin)
    loan1, loan2 = "Good Insurance Co - Loan.xlsx", "Good Insurance Co - Loan II.xlsx"
    for filename, tab, cells in [(loan1,"11a",["G74","F74"]),(loan2,"11b",["G24","F24"])]:
        for cell in cells: compare("M07",tab,cell,calc(filename,cell),"Original dated source, independent formulas engine")
    interest = Decimal(str(calc(loan1,"F74")))+Decimal(str(calc(loan2,"F24")))
    for cell, wanted in [("E80",interest),("E81",-ytd(2402)),("E82",-ytd(2402)-interest)]:
        compare("M07","11a",cell,wanted,"Combined independently recomputed loan interest / GL2402")
    principal=Decimal(str(calc(loan1,"G74")))+Decimal(str(calc(loan2,"G24")))
    for cell,wanted in [("E84",principal),("E85",-ytd(2600)-ytd(2601)),("E86",-ytd(2600)-ytd(2601)-principal)]:
        compare("M07","11a",cell,wanted,"Both independent loan principals / GL2600 and GL2601")
    compare("M08","13","B6",literal("AR_Accrual-1.xlsx","B4"),"Supplied division10 AR detail")
    for cell,wanted in [("B9",ytd(1101)),("B10",ytd(1101)-literal("AR_Accrual-1.xlsx","B4")),("B12",expected[(12,1101)][1])]:
        compare("M08","13",cell,wanted,"Division-specific original GL")
    opening = next(Decimal(str(r[4])) for r in march.worksheets[1].values if len(r)>4 and r[0]==10 and r[1]==2200)
    postings = sum(literal("Payroll-1.xlsx",c) for c in ["C25","C28","C32"])
    for cell,wanted in [("C21",calc("Payroll-1.xlsx","C21")),("D21",calc("Payroll-1.xlsx","D21")),
                        ("E29",calc("Payroll-1.xlsx","E29")),("C36",opening),("C37",postings),("C38",opening+postings),
                        ("C39",ytd(2200)),("C40",ytd(2200)-opening-postings)]:
        compare("M08","14",cell,wanted,"Original payroll calculation, signed postings and March/April GL")
    rebates = source_sum("Rebates-1.xlsx","B",4,10)
    uninvoiced = source_sum("Accr2011-1.xlsx","B",4,5)
    bonus = source_sum("AccrBonus-1.xlsx","B",5,12)
    misc = literal("AccrMisc-1.xlsx","C4")+Decimal(str(calc("AccrMisc-1.xlsx","B5")))+source_sum("AccrMisc-1.xlsx","B",6,9)
    for tab, detail_cell, control, diff, account, wanted, direction in [
        ("15","B11","B13","B14",2005,rebates,-1),("16","B7","B9","B10",2011,uninvoiced,1),
        ("17","B13","B21","B22",2401,bonus,1),("18","C10","C12","C13",2410,misc,1),
    ]:
        for cell, result in [(detail_cell,wanted),(control,-ytd(account)),(diff,direction*(-ytd(account)-wanted))]:
            compare("M08",tab,cell,result,"Signed original supporting rows / specific GL control")
    compare("M10","12","G6",-ytd(2000),"Known April AP ledger control")
    compare("M10","12","G8","unavailable","Detailed AP listing was not supplied")
    compare("M10","12","G12","Pending CFO","Draft handoff status")
    # Retain source transaction inputs and dated loan assumptions. This is a
    # data-contract measurement, not a UI text/snapshot test.
    inputs = []
    for filename, tab, ranges in [
        ("Legal_Dump-1.xlsx","10",[(3,59,1,13)]),
        (loan1,"11a",[(11,74,1,5)]),(loan2,"11b",[(11,24,1,5)]),
        ("Payroll-1.xlsx","14",[(5,20,2,4)]),
    ]:
        src=source(filename)
        for r0,r1,c0,c1 in ranges:
            for row in src.iter_rows(min_row=r0,max_row=r1,min_col=c0,max_col=c1):
                for cell in row:
                    if cell.data_type not in ("f","e") and cell.value is not None:
                        value=tabs[tab][cell.coordinate].value
                        expected_value=cell.value
                        if isinstance(expected_value,(int,float)):
                            match=isinstance(value,(int,float)) and abs(value-expected_value)<1e-7
                        else: match=value==expected_value
                        inputs.append({"source_file":filename,"schedule":tab,"cell":cell.coordinate,
                                       "contract":"SOURCE_INPUT_MATCH" if match else "SOURCE_INPUT_MISMATCH"})
    measured = not differences and not duplicates and not extra and all(x["contract"] == "AMOUNT_MATCH" for x in controls+numerical) and all(x["contract"]=="SOURCE_INPUT_MATCH" for x in inputs)
    return {"ledger":{"source_accounts":len(expected),"actual_accounts":len(actual),"differences":differences,"extra":extra,"duplicates":duplicates},
            "cash_controls":controls,"schedule_results":numerical,"retained_source_inputs":inputs,
            "source_engine":oracle["engine"],"measured_contracts_match":measured,"score":None,
            "scope":"Reference-template adapter: original ledger amounts, listed M02–M08/M10 numeric/source contracts. No aggregate or general candidate grade. M09 explanations, M10 action quality, M11 visual/layout, M12 refresh/self-containment, M13 judgments and professional validity require the separate actual review."}


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public",type=Path,required=True)
    parser.add_argument("--workbook",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--source-calculations",type=Path,required=True)
    args=parser.parse_args()
    result=measure(args.public,args.workbook,args.source_calculations)
    args.output.write_text(json.dumps(result,indent=2),encoding="utf-8")
    print(json.dumps({"measured_contracts_match":result["measured_contracts_match"],"source_accounts":result['ledger']['source_accounts'],"actual_accounts":result['ledger']['actual_accounts'],"ledger_differences":len(result['ledger']['differences']),"score":None}))
    raise SystemExit(0 if result["measured_contracts_match"] else 4)
