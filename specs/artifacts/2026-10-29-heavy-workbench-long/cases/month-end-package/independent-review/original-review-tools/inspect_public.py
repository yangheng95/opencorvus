import json, pathlib, openpyxl
root=pathlib.Path(r'D:\opencorvus-benchmark-runs\gdpval-month-end-review-20261101')
out={}
for p in sorted((root/'input/public').glob('*.xlsx')):
    w=openpyxl.load_workbook(p,read_only=True,data_only=False)
    v=openpyxl.load_workbook(p,read_only=True,data_only=True)
    out[p.name]={}
    for s in w:
        cached_cells={c.coordinate:c.value for row in v[s.title] for c in row if c.value is not None}
        rows=[]
        for row in s:
            cells=[]
            for c in row:
                if c.value is not None:
                    val=c.value
                    cells.append({'cell':c.coordinate,'value':str(val) if not isinstance(val,(str,int,float,bool)) else val,**({'cached':str(cached_cells.get(c.coordinate)) if not isinstance(cached_cells.get(c.coordinate),(str,int,float,bool,type(None))) else cached_cells.get(c.coordinate)} if c.data_type=='f' else {})})
            if cells: rows.append(cells)
        out[p.name][s.title]={'dimensions':s.calculate_dimension(),'rows':rows}
    w.close();v.close()
(root/'public-cell-inspection.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
for f,ss in out.items():
    print(f)
    for sn,d in ss.items(): print(' ',sn,d['dimensions'],'nonempty',sum(len(r) for r in d['rows']),'formulas',sum('cached'in c for r in d['rows'] for c in r))
