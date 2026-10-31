from pathlib import Path
import json,datetime,shutil
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();O=R/'repair-closure'
def write(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
E=O/'main-original-records';E.mkdir()
for n in ['original-boolean-AR-command.json','real-early-inspection-command.json','assessment-main-closed-recheck.json','assessment-weak-closed-recheck.json','assessment-iid-closed-recheck.json']:
 shutil.copy2(X/'concentrated-fix-checks'/n,E/n)
for n in ['actual-command.json','initial-prepare-command.json']:
 shutil.copy2(X/'wrong-early-inspection'/n,E/('real-lab-'+n))
shutil.copy2(X/'wrong-early-inspection/run/discovery-base/wire.jsonl',E/'real-lab-original-wire.jsonl')
for label,assignment,delivery in [('main','assessment-main','reference-delivery-final'),('weak','assessment-weak','weak-delivery')]:
 initial=json.loads((R/(label+'-review-initial.json')).read_text());a=json.loads((X/assignment/'assignment.json').read_text());assert initial['assignment_id']==a['assignment_id'];current=json.loads(json.dumps(initial));current['reviewed_at']=stamp;current['initial_review_preserved']=str(R/(label+'-review-initial.json'));current['repair_scope']='B01/B02 checker closure only; no content-rating change and no second native/planner/cold run.'
 for leaf in current['leaves']:
  cleaned=[]
  for source in leaf['evidence']:
   if '#False-certainty certification' in source:source=source.split('#')[0]+':31 (unheaded final certification paragraph)'
   cleaned.append(source)
  leaf['evidence']=cleaned
  if label=='weak' and leaf['id'] in ['H01','H05']:leaf['evidence']+=[str(R/'scientific-small-derivations.json')]
  if leaf['id']=='H03':leaf['evidence']+=[str(O/'closure-assessment.json')]
 for f in ['REPORT.md','HANDOFF.md']:
  assert (X/delivery/f).read_bytes()==(X/assignment/'closed/delivery'/f).read_bytes()
 write(R/(label+'-review.json'),current)
stage={'case_version':'L06/0.4.0-dev','reviewed_at':stamp,'reviewer':'/root/benchmark_review','scope':'One concentrated complete-case review plus the two identified blocker repairs. Initial observations/ratings/source/probes and sole cold retained.','remaining_substantive_blockers':[],'B01':{'status':'closed','observed_before':'Boolean due_week=true accepted as integer1 by M05','observed_after':'Same unchanged captured run + same mutated export now M05 verified_fail; normal original main/weak M05 pass','evidence':['repair-closure/original-boolean-AR-command.json','repair-closure/checker.diff','repair-closure/closure-assessment.json']},'B02':{'status':'closed','observed_before':'Observed invalid laboratory test A with zero pack classified blocked; first reviewer probe synthetic, then main captured an actual bad programme native1 with exact same failure','observed_after':'Same actual bad native/wire now M02 verified_fail/available_quarantine_pack; unexecuted leaves still blocked','evidence':['repair-closure/real-early-inspection-command.json','repair-closure/main-original-records/real-lab-actual-command.json','repair-closure/main-original-records/real-lab-initial-prepare-command.json','repair-closure/main-original-records/real-lab-original-wire.jsonl']},'allows_metadata_development_freeze':True,'allowed_changes':['FREEZE.json development_frozen=true with explicit restricted scope','README/status prose for the already reviewed development case'],'unchanged_required':['L06/0.4.0-dev identity','all public facts/physical and information law','registered exact same-information optima and 101/100 ratio','17 IDs and weights/critical/100 denominator/90 good rule','actual actor/controller/native/report/figures and original assignment objects'],'main_assignment_id':'l06-inspection-3d181980ae724480aa07d91e12a3b97a','weak_assignment_id':'l06-inspection-acb4769758c1489e828ad363e1d3fd63','formal_reviews':['main-review.json','weak-review.json'],'original_content_decisions_unchanged':True,'aggregate':'not computed or handwritten by reviewer; root must run actual grader','actual_rebuild_seconds':168.5232507,'limitations':['Non-blind single AI-agent familiar with author/earlier L06 work, not professional human review','One actual source-only rebuild and finite simulated support are not measured useful candidate hours','Real wrong-IID quality failure and wrong hard-constraint/control failures do not demonstrate fresh LLM difficulty/discrimination','No arbitrary failure, physical power-loss, OS/filesystem/memory/side-channel security or real financial approval certification','No statistical-maturity or complete-ten-heavy-case approval'],'new_native_actor_solver_after_initial_review':False}
write(R/'stage-assessment.json',stage)
text='''# L06/0.4整题最终独审

**原两项实质阻断已闭合，没有剩余已知实质阻断。允许仅作开发冻结元数据/README收口。** 不改L06/0.4.0-dev身份、原公料/业务信息法则、注册精确最优值和101/100目标、17叶/100分/critical/90规则或原执行对象。根agent仍须运行真正grade；本审查没有手写总分。

主正式`main-review.json`绑定原assignment `l06-inspection-3d181980ae724480aa07d91e12a3b97a`，五H均verified_pass。弱`weak-review.json`绑定原assignment `l06-inspection-acb4769758c1489e828ad363e1d3fd63`，H01/H05 verified_fail，其余三H verified_pass；真实REPORT.md第31行无标题末段肯定声称首测确定四标签及所有现实网络/掉电财务保证。正确账表和早先限制文字不能抵消该强声明。初评/seal不覆盖；初评的`#False-certainty certification`仅描述性定位，最终改为精确31行。

|原阻断|修后实际观察|结论|
|---|---|---|
|B01：AR JSON true误等于due_week整数1|原同一输入/原native/原布尔导出重进当前checker，M05 verified_fail；AR严格数组/对象/身份/amount及due_week plain int。合法整数AR/行序和等值2/6仍通过。|闭合|
|B02：已观察非法lab动作误作blocked|原合成partial映射失败保留。主方另外真正封源执行了test A但qa=0的programme，实际native1 available_quarantine_pack，旧checker仍blocked；当前同一真实原件由我重进CLI得M02 verified_fail，未运行下游仍blocked。修后逐两正概率lab结果检查，资金失败仍独立映射M06。|闭合|

原/修后完整源码及CLI分别保留在case-initial、whole-checker-observations、repair-closure；唯一实际差异见repair-closure/checker.diff，另收紧同语义布尔概率/分项费用边界，没有改物理或参考动作。repair-closure/closure-assessment.json记录本人两个真实checker命令、正向类型/有理数边界、public/reference-source/rubric/registered原字节不变以及主方原closed重算记录：主/弱12M仍全pass、实际wrong-IID仅M04fail。此修后复核只重读/重checker，不重新actor、DP、solver或cold；原168.523秒cold实际执行的是当时封存的源码，不追认为执行了后来修过的private checker。

整题核心结论来自独立标准库raw CSV/Fraction与复制SQLite/WAL/SHM逐笔重建，而非作者core自比：原和唯一新cold各3152阶段、三个输入197条正概率终结路径、每输入质量1；原packet/payload/key/receipt/post-state、每笔成本/现金/AR及完整逻辑path均闭合。准确期望成本为300834939/4000000、11287373277/128000000、90125954529/1280000000；最低现金-13/-15/-13，最低终态现金4/0/1，实际最大good峰3（cap4）。新episode不同但原逻辑路径导出实际checker通过，不强迫部署ID或参考动作。明细：whole-raw-SQL-audit.json、independent-logical-stage-values.json、source-native-binding.json。

完整有限Bellman源审及唯一自含重建的实际public-physics证书覆盖合法动作/两正概率验货结果、终期处置和现金边界；week/phase/material/quarantine/cash/likelihood quotient在这批强制销售/lead1原事实下充分。class-known仍未知未来lot，独立核加权与差额见scientific-small-derivations.json；未另跑第二规划器或声称对class-known另作完整独立证书。A1/A2及B1/B2在所有供应商下同法则，其后验比永远不变；base首A-good后仍为17/80,51/80,9/80,3/80，直接否定弱版标签确定性。

自含source.zip冷重建只一次，168.5232507秒自然exit0，重新规划/验完整证书/实际执行全部原生路径和两controller73/行序并重画。源、命令、PID、stdout/stderr、终态和新结果保在cold-originals.zip及cold-owner-terminal.json。原200条controller命令实为198×0+2×73，workers真实EOF0而非被杀；两原receipt/已观察结果在新进程同键复用，原SQL全保留。没有物理掉电或任意网络故障验证，也没有同用户OS安全隔离认证。

主3图、弱3图及新cold信息图均实际view；成本/提前class信息、stage现金区间/概率加权中位/底线、material峰值、alias熵底线和选验/采购概率的单位与范围可读。新wrong-IID真实完整2768阶段亦独立核：后验、物理、现金、恢复成立，真成本1194683/12800、1208591527/12800000、4888983507/64000000均超过101/100；是规划质量坏对照，不是由硬约束错误代替。其11M通过/M04失败原记录已核，未额外给五H/总分。其它四原错误programme有原wire/SQL具名错误，未执行依赖仍blocked。

审查非盲，由熟悉作者和先前L06工作的单个AI agent完成。允许该完整可执行开发合同冻结并供后续fresh pilot；不认证fresh LLM区分度、有效几个小时、职业真人/统计成熟、任意故障/真实财务或十题完成。参考重建秒数、阶段/路径/文件/叶数均不是上述实证。原路径定位错误、初grade工具问题及旧版本全部保留，未计作候选失败。未触及L01、Provider、凭据、用户进程、Docker/WSL/UI、主方实现或原assignment。
'''
(R/'REVIEW.md').write_text(text,encoding='utf-8');(R/'REVIEW-FINAL.md').write_text(text,encoding='utf-8');write(R/'FINAL-SEAL.json',{'sealed_at':stamp,'files':['REVIEW.md','REVIEW-FINAL.md','main-review.json','weak-review.json','stage-assessment.json'],'initial_preserved':True,'allows_metadata_development_freeze':True,'aggregate_not_written':True});print(json.dumps({'at':stamp,'main_review':str(R/'main-review.json'),'weak_review':str(R/'weak-review.json'),'freeze':'development metadata only','remaining_blockers':[]},ensure_ascii=False))
