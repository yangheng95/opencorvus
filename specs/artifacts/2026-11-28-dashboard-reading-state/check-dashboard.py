from pathlib import Path
from decimal import Decimal
import json,urllib.request,urllib.parse,csv,sys
s=Path(__file__).parent;label=sys.argv[1]
r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'))
session='ses_hV1OnPAfOAfCSKWMunWr';artifact='art_g0Vc91zED00L3QeOwJ39'
url=r['url']+'session/'+session+'/interactive-artifact/'+artifact+'?directory='+urllib.parse.quote(r['project'])
with urllib.request.urlopen(url) as response:
    assert response.status==200
    actual=json.load(response)
p=actual['payload'];assert p==json.loads((s/'original-dashboard.json').read_text(encoding='utf-8'))
assert actual['id']==artifact and actual['sessionID']==session and p['renderer']=='dashboard@1'
with (s/'original-project-files/sales.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
assert len(rows)==len(p['data'])==5
for row,source in zip(p['data'],rows):
    for key in ['订单编号','区域','备注']:assert row[key]==source[key]
    amount=Decimal(source['金额']);assert Decimal(str(row['金额']))==amount and row['金额分']==int(amount*100)
    assert row['是否退款']==('是' if amount<0 else '否') and row['退款标记']==int(amount<0) and row['零金额标记']==int(amount==0)
assert {m['id']:m['value'] for m in p['metrics']}=={'all-orders':5,'all-net':'35.60','all-refunds':1,'all-zeros':1}
facts=[]
for region,refund,count,net in [(None,None,5,'35.60'),('华东','是',1,'-2.05'),('华南','是',0,'0.00'),('华南','否',2,'7.35'),('华东',None,3,'28.25')]:
    selected=[row for row in rows if (region is None or row['区域']==region) and (refund is None or ('是' if Decimal(row['金额'])<0 else '否')==refund)]
    assert len(selected)==count and sum((Decimal(row['金额']) for row in selected),Decimal('0.00'))==Decimal(net)
    facts.append({'region':region,'refund':refund,'orders':count,'net':net,'ordersIDs':[row['订单编号'] for row in selected]})
(s/('api-dashboard-'+label+'.json')).write_text(json.dumps(actual,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'status':'passed','label':label,'sessionID':session,'artifactID':artifact,'httpStatus':200,'equalsOriginalPublication':True,'dataRows':5,'metrics':'unchanged declared whole-source values','selections':facts,'viewIDs':[v['id'] for v in p['views']],'filterIDs':[f['id'] for f in p['filters']]}
(s/('dashboard-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
