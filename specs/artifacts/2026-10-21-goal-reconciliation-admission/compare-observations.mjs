import fs from 'node:fs'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',source=base+'/goal-deliverable-navigation-498-after-data/runtime/log/dev.log'
const rows=fs.readFileSync(source,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line))
const ticks=rows.filter(row=>row.service==='scheduler'&&row.message==='run'&&row.data.id==='continuous-goal.reconcile')
const from=Date.parse(ticks[0].time),to=from+60000,window=rows.filter(row=>Date.parse(row.time)>=from&&Date.parse(row.time)<to)
const after=JSON.parse(fs.readFileSync(root+'/runtime-observation.json','utf8'))
const result={at:new Date().toISOString(),before:{source:'Original498-after complete raw log,current baseline scheduler,physically settled',window:{from:new Date(from).toISOString(),to:new Date(to).toISOString(),ticks:window.filter(row=>row.service==='scheduler'&&row.message==='run'&&row.data.id==='continuous-goal.reconcile').length,goalProjectFailures:window.filter(row=>row.service==='continuous-goal'&&row.message==='goal project reconciliation failed').length,configValidationStarts:window.filter(row=>row.service==='project.open'&&row.message==='project.open.stage'&&row.data.stage==='config.validate'&&row.data.status==='started').length}},after:{window:after.window,totalActualTicks:after.totalActualTicks,goal:after.actualGoal,candidates:after.executionCandidates},boundary:'Two actual60s windows;not a UI performance benchmark. Five after config starts are retained aggregate observations alongside real runtime-read400;this report does not attribute every start to a request or claim all initialization ceased.'}
fs.writeFileSync(root+'/before-after-observation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(result))
