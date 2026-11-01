import json,pathlib,openpyxl
root=pathlib.Path(r'D:\opencorvus-benchmark-runs\gdpval-month-end-review-20261101')
out={}
for variant in ['reference','wrong-stale-tb']:
    p=root/'input'/variant/'Aurisic_Financials_4-25-1.xlsx'
    w=openpyxl.load_workbook(p,data_only=False)
    v=openpyxl.load_workbook(p,read_only=True,data_only=True)
    out[variant]={}
    for s in w:
        caches={c.coordinate:c.value for row in v[s.title] for c in row if c.value is not None}
        cells={}
        for row in s:
            for c in row:
                if c.value is not None:
                    val=c.value
                    cells[c.coordinate]={'value':str(val) if not isinstance(val,(str,int,float,bool)) else val,**({'cached':caches.get(c.coordinate)} if c.data_type=='f' else {}),'format':c.number_format}
        out[variant][s.title]={'dimensions':s.calculate_dimension(),'cells':cells,'freeze':str(s.freeze_panes),'merges':[str(x) for x in s.merged_cells.ranges],'hidden_columns':[{ 'key':k,'min':x.min,'max':x.max,'width':x.width,'hidden':x.hidden,'outline':x.outlineLevel} for k,x in s.column_dimensions.items() if x.hidden or x.outlineLevel],'hidden_rows':[i for i,x in s.row_dimensions.items() if x.hidden]}
    w.close();v.close()
(root/'target-cell-inspection.json').write_text(json.dumps(out,indent=2,default=str),encoding='utf-8')
for variant,ss in out.items():
    print(variant)
    for sn,d in ss.items(): print(sn,d['dimensions'],'nonempty',len(d['cells']),'formulas',sum('cached'in c for c in d['cells'].values()))
