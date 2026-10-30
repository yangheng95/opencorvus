import csv,json,sys
rows={}
for x in csv.DictReader(open(sys.argv[1],encoding='utf-8')):
 rows[x['item']]={'tenant':x['tenant'],'item':x['item'],'units':int(float(x['units'])),'status':'ready'}
json.dump({'self_status':'ok','items':list(rows.values())},open(sys.argv[2],'w',encoding='utf-8'))
