"""Runnable small teaching example, separate from the capstone assessment data."""
import argparse,csv,sqlite3,json
from pathlib import Path
from l09_lab import decode,save
def run(out):
 out.mkdir(parents=True,exist_ok=False);fields=['row_id','tenant','event_id','order_id','revision','released_at','status','amount','currency']
 rows=[dict(zip(fields,['A1','Example-A','E1','shared', '1','2026-01-01T00:00:00Z','active','12.50','USD'])),dict(zip(fields,['B1','Example-B','E1','shared','1','2026-01-01T00:00:00Z','active','20.75','USD']))]
 with (out/'two-row-intake.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 converted=[decode(x)[0] for x in rows];bad=dict(rows[0],row_id='bad',amount='1.005');_,error=decode(bad);save(out/'intake-results.json',{'admitted':converted,'invalid_grid':{'row_id':'bad','amount':'1.005','error':error},'explanation':'Same order/event spelling in different tenants is distinct; exact cents1250/2075, not rounding1.005.'})
 db=sqlite3.connect(':memory:');db.execute('create table example(tenant text,order_id text,revision integer,status text,amount_minor integer)');db.executemany('insert into example values(?,?,?,?,?)',[('Example-A','shared',1,'active',1250),('Example-B','shared',1,'active',2075),('Example-A','shared',2,'missing',None),('Example-B','shared',2,'cancelled',0)])
 queries={'1_original_rows':'select * from example order by tenant,revision','2_highest_revision':'select tenant,order_id,max(revision) revision from example group by tenant,order_id','3_join_to_raw':'select a.* from example a join (select tenant,order_id,max(revision) revision from example group by tenant,order_id) b using(tenant,order_id,revision)','4_equivalent_window':'select tenant,order_id,revision,status,amount_minor from (select *,dense_rank() over(partition by tenant,order_id order by revision desc) rank from example) where rank=1','5_wrong_valid_first':'select tenant,order_id,sum(amount_minor) from example where status=\'active\' group by tenant,order_id'}
 results={k:[list(x) for x in db.execute(q)] for k,q in queries.items()};db.close();save(out/'query-fragments-results.json',results);(out/'query-fragments.sql').write_text('\n\n'.join('-- '+k+'\n'+q+';' for k,q in queries.items()),encoding='utf-8')
 if sorted(results['3_join_to_raw'])!=sorted(results['4_equivalent_window']):raise ValueError('worked_SQL_equivalence')
 (out/'WALKTHROUGH.md').write_text('''# Executed worked example

First read two-row-intake.csv. Example-A/shared and Example-B/shared are two identities. Exact USD cent conversion is1250/2075;1.005 is rejected as amount_grid instead of rounded. Run the included l09_worked.py against a fresh output to reproduce intake-results.json.

Execute query-fragments.sql in order against its supplied in-memory example or rerun the helper. Fragment1 shows all four event rows. Fragment2 finds revision2 separately for both tenants. Fragment3 rejoins selected revision to the original states: A missing/null and B cancelled/0. Fragment4's dense_rank partition gives the same rows with a different SQL formulation. Fragment5 is intentionally wrong: filtering active first resurrects1250/2075 and loses the latest missing/cancelled states. The actual returned rows are in query-fragments-results.json; these are a small worked illustration, not hidden assessment answers.

Retrieval: explain why missing is not a zero observation, why cancelled is known zero, and why an older active row cannot repair either. Transfer: change one tenant or a valid amount and predict which intermediate relation and final state will change. The next course dataset adds conflicts, arrivals and receipts; this example alone does not establish full pipeline competence.
''',encoding='utf-8')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',required=True,type=Path);a=p.parse_args();run(a.out)
