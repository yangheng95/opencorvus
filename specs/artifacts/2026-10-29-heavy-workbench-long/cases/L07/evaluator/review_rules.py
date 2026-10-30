"""Single case policy calculation from original HTML groups, not cleaned effects."""
from pathlib import Path
from html.parser import HTMLParser
from fractions import Fraction as F
from datetime import datetime,timezone
import csv,json,math

def read_json(p):
    def pairs(items):
        out={}
        for k,v in items:
            if k in out:raise ValueError('duplicate JSON key')
            out[k]=v
        return out
    return json.loads(Path(p).read_text(encoding='utf-8'),object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError('finite JSON required')))
def utc(s):
    p=datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    if p.strftime('%Y-%m-%dT%H:%M:%SZ')!=s:raise ValueError('canonical UTC required')
    return p
def table(path):
    with Path(path).open(encoding='utf-8',newline='') as f:return list(csv.DictReader(f))

class Document(HTMLParser):
    def __init__(self,text):
        super().__init__(convert_charrefs=True);self.meta={};self.rows=[];self.tag=None;self.text=[];self.key=None;self.head=[];self.row=[];self.table_id=None;self.feed(text)
    def handle_starttag(self,tag,attrs):
        if tag=='table':self.table_id=dict(attrs).get('id')
        if tag=='tr':self.row=[]
        if tag in ['dt','dd','td','th']:self.tag=tag;self.text=[]
    def handle_data(self,data):
        if self.tag:self.text.append(data)
    def handle_endtag(self,tag):
        if tag==self.tag:
            value=''.join(self.text).strip()
            if tag=='dt':self.key=value
            elif tag=='dd':self.meta[self.key]=value
            else:self.row.append(value)
            self.tag=None
        if tag=='tr' and self.table_id=='outcomes':
            if not self.head:self.head=self.row
            else:
                if len(self.row)!=len(self.head):raise ValueError('original table column count')
                self.rows.append(dict(zip(self.head,self.row)))
        if tag=='table':self.table_id=None

def merge(arms):
    n=sum(a['n'] for a in arms);mean=sum(a['n']*a['mean'] for a in arms)/n
    variance=sum((a['n']-1)*a['sd2']+a['n']*(a['mean']-mean)**2 for a in arms)/(n-1)
    return n,mean,variance

def group_fact(row,policy):
    n=int(row['n']);factor=F(policy['unit_factor'][row['units']]);mean=F(row['mean'])*factor*policy['endpoint_direction'].get(row['endpoint'],1)
    if n<2 or row['spread_kind'] not in ['SD','SE','NR']:raise ValueError('original group n/spread type invalid')
    sd2=None if row['spread']=='NR' else (F(row['spread'])*factor)**2*(n if row['spread_kind']=='SE' else 1)
    return {'arm':row['arm'],'n':n,'mean':mean,'sd2':sd2}

def pool(effects,critical,random=False):
    if not effects:return {'status':'not_estimable','studies':[],'k':0,**{n:None for n in ['mean_exact','variance_exact','q_exact','i2_exact','tau2_exact','lo','hi']},'weights':[]}
    w=[1/e['v'] for e in effects];sw=sum(w);mean=sum(a*e['md'] for a,e in zip(w,effects))/sw
    q=sum(a*(e['md']-mean)**2 for a,e in zip(w,effects));df=len(effects)-1
    i2=max(F(0),(q-df)/q) if q else F(0);den=sw-sum(a*a for a in w)/sw
    tau=max(F(0),(q-df)/den) if random and den else F(0)
    weights=[1/(e['v']+tau) for e in effects];total=sum(weights);m=sum(a*e['md'] for a,e in zip(weights,effects))/total;v=1/total;radius=float(critical)*math.sqrt(float(v))
    return {'status':'estimated','studies':[e['registry'] for e in effects],'k':len(effects),'mean_exact':str(m),'variance_exact':str(v),
      'q_exact':str(q),'i2_exact':str(i2),'tau2_exact':str(tau),'lo':float(m)-radius,'hi':float(m)+radius,
      'weights':[{'registry':e['registry'],'weight_exact':str(a),'normalized_exact':str(a/total)} for a,e in zip(weights,effects)]}

def representatives(studies,relations,possible=True):
    ids=[r['registry'] for r in studies if r['status'] in ['included','nonindependent']];parent={i:i for i in ids}
    def find(x):
        while parent[x]!=x:x=parent[x]
        return x
    def union(a,b):
        if a in parent and b in parent:parent[find(b)]=find(a)
    for a in studies:
        for b in studies:
            if a['cohort']==b['cohort']:union(a['registry'],b['registry'])
    for r in relations:
        if r['relation']=='certain_same' or possible:union(r['registry_a'],r['registry_b'])
    groups={}
    for i in ids:groups.setdefault(find(i),[]).append(i)
    lookup={r['registry']:r for r in studies};answer={}
    for values in groups.values():
        chosen=min(values,key=lambda x:(lookup[x]['role']!='primary',lookup[x]['registered_on'],x))
        for x in values:answer[x]=chosen
    return answer

def stage(root,policy,cutoff):
    root=Path(root);all_reports=table(root/'archive/index.csv');seen=set();reports=[];documents={}
    for r in all_reports:
        utc(r['released_at']);identity=r['report_id']
        if identity in seen:raise ValueError('duplicate report identity')
        seen.add(identity);path=root/'archive'/r['file']
        if not path.resolve().is_relative_to((root/'archive').resolve()) or not path.is_file():raise ValueError('ordinary corpus source required')
        if r['released_at']>cutoff:continue
        doc=Document(path.read_text(encoding='utf-8'));documents[identity]=doc
        reports.append({'report_id':identity,'registry':doc.meta['Registration record'],'kind':r['kind'],'revision':int(r['revision']),'released_at':r['released_at']})
    families={}
    for r in reports:families.setdefault(r['registry'],[]).append(r)
    studies=[];effects=[];internals={}
    for registry,family in sorted(families.items()):
        regs=[r for r in family if r['kind']=='registry']
        if len(regs)!=1:raise ValueError('one published registry per family required')
        meta=documents[regs[0]['report_id']].meta
        study={'registry':registry,'report_ids':sorted(r['report_id'] for r in family),'population':meta['Population'],'allocation':meta['Assignment mechanism'],
          'cohort':meta['Cohort code'],'role':meta['Study role'],'registered_on':meta['Registered on'],'status':'included','reason':'eligible registered comparison',
          'selected_endpoint':None,'selected_week':None,'main_representative':None,'groups':[]}
        nt,nc=int(meta['Randomized experimental']),int(meta['Randomized control']);group_rows={};sources={};facts={};candidates={}
        for r in sorted([r for r in family if r['kind']!='registry'],key=lambda r:(policy['source_priority'][r['kind']],r['revision'],r['released_at'],r['report_id'])):
            doc=documents[r['report_id']]
            for name in ['Allocation concealment','Outcome assessor']:
                if name in doc.meta:facts[name]=doc.meta[name]
            for row in doc.rows:
                key=(row['endpoint'],int(row['week']),row['arm']);rank=(policy['source_priority'][r['kind']],r['revision'],r['released_at'])
                candidates.setdefault(key,[]).append((rank,row,{'report_id':r['report_id'],'table_id':'outcomes','row_id':row['row_id']}))
        for key,values in candidates.items():
            highest=max(rank for rank,row,source in values);current=[(row,source) for rank,row,source in values if rank==highest]
            fact=group_fact(current[0][0],policy)
            if any(group_fact(row,policy)!=fact for row,source in current[1:]):raise ValueError('facility_corpus_conflict: '+registry+str(key))
            group_rows[key],sources[key]=current[-1]
        status='excluded_population' if meta['Population']!='adult workers' else 'excluded_comparison' if (meta['Experimental condition'],meta['Comparator'])!=('simulator','routine') else 'excluded_design' if meta['Assignment mechanism'] not in ['individual lottery','classroom lottery'] else None
        if status:study.update(status=status,reason='registered eligibility boundary')
        else:
            endpoint=next((e for e in policy['endpoint_priority'] if any(k[0]==e and policy['week_min']<=k[1]<=policy['week_max'] for k in group_rows)),None)
            if endpoint is None:study.update(status='no_endpoint',reason='no eligible registered construct/time')
            else:
                weeks={k[1] for k in group_rows if k[0]==endpoint and policy['week_min']<=k[1]<=policy['week_max']};week=min(weeks,key=lambda w:(abs(w-policy['week_target']),-w))
                study.update(selected_endpoint=endpoint,selected_week=week);internal=[]
                for key,row in sorted(group_rows.items()):
                    if key[:2]!=(endpoint,week):continue
                    a=group_fact(row,policy);n,mean,sd2=a['n'],a['mean'],a['sd2'];internal.append(a)
                    study['groups'].append({'arm':a['arm'],'n':n,'mean_points_exact':str(mean),'sd2_points_exact':None if sd2 is None else str(sd2),'source':sources[key]})
                if not internal or sum(a['arm']=='C' for a in internal)!=1 or not any(a['arm'].startswith('T') for a in internal):raise ValueError('complete eligible arm structure required')
                if any(a['sd2'] is None for a in internal):study.update(status='not_estimable',reason='eligible groups lack dispersion; NR is not zero')
                else:
                    tn,tm,ts=merge([a for a in internal if a['arm'].startswith('T')]);cn,cm,cs=merge([a for a in internal if a['arm']=='C'])
                    icc=None;icc_status='not_applicable';de=F(1)
                    if meta['Assignment mechanism']=='classroom lottery':
                        icc_status='imputed' if meta['ICC']=='not reported' else 'reported';icc=F(policy['icc_missing_main'] if icc_status=='imputed' else meta['ICC']);de=1+(F(meta['Cluster size'])-1)*icc
                    e={'registry':registry,'md_exact':str(tm-cm),'variance_exact':str((ts/tn+cs/cn)*de),'icc_exact':None if icc is None else str(icc),'icc_status':icc_status,'design_effect_exact':str(de)};effects.append(e)
                    internals[registry]={'registry':registry,'md':tm-cm,'v':F(e['variance_exact']),'m':None if icc is None else F(meta['Cluster size']),'de':de,'imputed':icc_status=='imputed'}
        observed=sum(g['n'] for g in study['groups']) if study['groups'] else None;attr=None if observed is None else 1-F(observed,nt+nc)
        study['risk_facts']={'randomized_n':nt+nc,'observed_n':observed,'attrition_exact':None if attr is None else str(attr),
          'high_attrition':None if observed is None else F(observed,nt+nc)<F(policy['observed_fraction_high_risk_below']),
          'concealment':facts.get('Allocation concealment','not reported'),'assessor':facts.get('Outcome assessor','not reported')}
        studies.append(study)
    relations=[]
    for r in table(root/'correspondence.csv'):
        utc(r['released_at'])
        if r['released_at']<=cutoff:
            if r['relation'] not in ['certain_same','possible']:raise ValueError('explicit overlap relation required')
            relations.append(r)
    reps=representatives(studies,relations)
    for s in studies:
        if s['registry'] in reps:
            s['main_representative']=reps[s['registry']]
            if reps[s['registry']]!=s['registry']:s.update(status='nonindependent',reason='primary conservative cohort representative retained; possible is not proven overlap')
    include=[internals[s['registry']] for s in studies if s['status']=='included'];distinct=representatives(studies,relations,possible=False)
    all_distinct=[internals[s['registry']] for s in studies if distinct.get(s['registry'])==s['registry']]
    risk={s['registry']:s['risk_facts']['high_attrition'] for s in studies}
    def icc_version(value):
        return [{**e,'v':e['v']/e['de']*(1+(e['m']-1)*F(value))} if e['imputed'] else e for e in include]
    def pooled(values,random=False):return pool(values,F(policy['normal_critical']),random)
    analyses={'main_fixed':pooled(include),'random_DL':pooled(include,True),'exclude_high_attrition':pooled([e for e in include if not risk[e['registry']]]),
      'icc_zero':pooled(icc_version(policy['icc_missing_low'])),'icc_high':pooled(icc_version(policy['icc_missing_high'])),'assume_distinct':pooled(all_distinct)}
    leave={e['registry']:pooled([x for x in include if x['registry']!=e['registry']]) for e in include}
    return {'reports':reports,'studies':studies,'effects':effects,'analyses':analyses,'leave_one_out':leave}

def review(root):
    policy=read_json(Path(root)/'protocol.json');stages={}
    for s in policy['stages']:utc(s['cutoff']);stages[s['id']]=stage(root,policy,s['cutoff'])
    changes=[]
    for a,b in zip(policy['stages'],policy['stages'][1:]):
        before,after=stages[a['id']],stages[b['id']];bs={s['registry']:s for s in before['studies']};ass={s['registry']:s for s in after['studies']};be={s['registry']:s for s in before['effects']};ae={s['registry']:s for s in after['effects']};rows=[]
        for r in sorted(set(bs)|set(ass)):
            row={'registry':r}
            for prefix,ss,es in [('before',bs,be),('after',ass,ae)]:
                row[prefix+'_status']=ss.get(r,{}).get('status');row[prefix+'_md_exact']=es.get(r,{}).get('md_exact');row[prefix+'_variance_exact']=es.get(r,{}).get('variance_exact');row[prefix+'_sources']=[g['source'] for g in ss.get(r,{}).get('groups',[])]
            rows.append(row)
        bm=before['analyses']['main_fixed']['mean_exact'];am=after['analyses']['main_fixed']['mean_exact']
        changes.append({'from':a['id'],'to':b['id'],'studies':rows,'before_main_exact':bm,'after_main_exact':am,'delta_main_exact':None if bm is None or am is None else str(F(am)-F(bm))})
    return {'format':'l07-review-result/1','stages':stages,'changes':changes}
