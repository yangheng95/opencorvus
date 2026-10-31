"""Construct the registered synthetic originals once, before scientific execution."""
from pathlib import Path
import csv, json

ROOT = Path(__file__).resolve().parents[1] / 'public'

def csv_file(path, header, rows):
    with path.open('x', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(header); w.writerows(rows)

def main():
    for ident, cash, prior in [('base',18,[1,3,3,1]),
                                ('shifted-prior',18,[3,9,3,1]),
                                ('cash-tight',14,[1,3,3,1])]:
        folder = ROOT/'instances'/ident; folder.mkdir(exist_ok=True)
        assert not (folder/'profile.json').exists(), 'registered originals already exist'
        config = {'format':'l06-inspection-input/1','id':ident,'weeks':8,
                  'raw_capacity':4,'pack_good_units':2,'initial_cash':cash,
                  'cash_floor':-15,'production_cost':1,'revenue':12,
                  'lab_fee':1,'holding':1,'terminal_good_disposal':1,
                  'terminal_pack_disposal':1,'sales_receipt_lag':2}
        (folder/'profile.json').write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
        csv_file(folder/'weeks.csv',['week','demand','certified_unit_cost'],
                 zip(range(8),[1,2,1,2,2,1,2,1],[8,8,9,9,11,11,8,8]))
        csv_file(folder/'suppliers.csv',['supplier','pack_cost','lead','quarantine_pack_limit'],
                 [('A',3,1,1),('B',4,1,1)])
        modes = [(m,prior[i],sum(prior),17 if i<2 else 3,20,3 if i<2 else 17,20)
                 for i,m in enumerate(['A1','A2','B1','B2'])]
        csv_file(folder/'latent-law.csv',
                 ['latent_id','prior_num','prior_den','A_good_num','A_good_den','B_good_num','B_good_den'],modes)
        csv_file(folder/'opening-receivables.csv',['receipt_id','amount','due_week'],
                 [('prior-completed-job',10,1)])
    print('registered three complete eight-week original inputs written')

if __name__ == '__main__': main()
