"""Read-only root corroboration of specific findings from the one review."""
import datetime,json,pathlib,openpyxl
Q=pathlib.Path(__file__).parent;S=Q/'input'
requests=[
 ('reference/Aurisic_Financials_4-25-1.xlsx','#17) Bonus Accrual #2401',['B12','B13','B15','B21','B22']),
 ('reference/Aurisic_Financials_4-25-1.xlsx','#14) Payroll Accrual #2200',['E18']),
 ('public/AccrBonus-1.xlsx',0,['B12','B13','B15']),
 ('public/Payroll-1.xlsx',0,['E18']),
 ('public/Aurisic_Corp_Payrolls_April_2025-1.xlsx',0,['E18']),
 ('public/Aurisic_Financials_3-25-1.xlsx',1,['C102','D102','E102','C103','D103','E103','C104','D104','E104','C114','D114','E114']),
 ('reference/Aurisic_Financials_4-25-1.xlsx',1,['C109','D109','E109','C110','D110','E110','C111','D111','E111','C112','D112','E112','C113','D113','E113','C114','D114','E114']),
 ('public/Legal_Dump-1.xlsx',0,['C55','D55','K55','M55','C56','D56','K56','M56']),
 ('public/Accr2011-1.xlsx',0,['A5','B5']),
]
books={};observed=[]
for file,sheet,cells in requests:
 if file not in books:books[file]=(openpyxl.load_workbook(S/file,data_only=False),openpyxl.load_workbook(S/file,data_only=True))
 a,b=books[file]
 src=a.worksheets[sheet] if isinstance(sheet,int) else a[sheet]
 val=b[src.title]
 observed.append({'file':file,'sheet':src.title,'cells':{c:{'formula_or_input':src[c].value,'saved_value':val[c].value}for c in cells}})
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'assignment_id':'month-end-whole-case-38c7a899ab9c4d5388e2ae1ac9cfa209','method':'Read saved formulas/inputs and caches from frozen originals. No workbook write, evaluation, refresh, renderer, producer or checker execution. These observations corroborate specific review findings, not a second whole-case review.',
 'observations':observed,'interpretation_boundaries':['Bonus copied fixed summary currently equals its rollforward; refresh risk is static dependency inference, not observed current amount error.','Source-backed bridge candidates need company confirmation; numeric identity alone does not establish causal accounting reconciliation.','Lost payroll annotation and removed TB summary meaning are distinct from correctly preserved numeric inputs.']}
(Q/'root-reconciliation.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
print(json.dumps({'observations':len(observed),'method':'read-only saved cells','reference_payroll_E18':observed[1]['cells']['E18']['saved_value'],'new_author_execution':False}))
