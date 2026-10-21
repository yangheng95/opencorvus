import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',scope=base+'/goal-reconciliation-admission-499-after',data=base+'/goal-reconciliation-admission-499-after-data'
const rows=fs.readFileSync(data+'/runtime/log/dev.log','utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line))
const ticks=rows.filter(row=>row.service==='scheduler'&&row.message==='run'&&row.data.id==='continuous-goal.reconcile')
assert(ticks.length>=60,'At least60 actual original scheduler invocations required')
const start=Date.parse(ticks[0].time),end=start+60000
assert(Date.parse(ticks.at(-1).time)>=end,'The original scheduler must have progressed across a full60s window')
const window=rows.filter(row=>Date.parse(row.time)>=start&&Date.parse(row.time)<end)
const plan=JSON.parse(fs.readFileSync(scope+'/evidence/project-plan.json','utf8'))
const limited=plan.goals.find(goal=>goal.id==='pev_g0VYaYkAL00R3JWBJBHG')
assert.deepEqual({status:limited.status,reason:limited.reason,turns:limited.turnsAccepted,limit:limited.turnBudget,tokens:limited.tokensUsed},{status:'budget_limited',reason:'turn_budget',turns:1,limit:1,tokens:37196})
const response=await fetch('http://127.0.0.1:18883/global/health'),health=await response.json();assert.equal(response.status,200);assert.equal(health.healthy,true)
const observation={at:new Date().toISOString(),boundary:'Actual full Source CLI scheduler logs,public health and production candidate projection;not a timer fixture or UI test',firstOriginalTick:ticks[0].time,lastOriginalTick:ticks.at(-1).time,totalActualTicks:ticks.length,window:{from:new Date(start).toISOString(),to:new Date(end).toISOString(),ticks:window.filter(row=>row.service==='scheduler'&&row.message==='run'&&row.data.id==='continuous-goal.reconcile').length,goalProjectFailures:window.filter(row=>row.service==='continuous-goal'&&row.message==='goal project reconciliation failed').length,goalOwnerFailures:window.filter(row=>row.service==='continuous-goal'&&row.message==='goal reconciliation failed').length,configValidationStarts:window.filter(row=>row.service==='project.open'&&row.message==='project.open.stage'&&row.data.stage==='config.validate'&&row.data.status==='started').length},allGoalProjectFailures:rows.filter(row=>row.service==='continuous-goal'&&row.message==='goal project reconciliation failed').length,actualGoal:limited,executionCandidates:plan.candidates,health:{status:response.status,healthy:health.healthy},modelInputs:0}
fs.writeFileSync(root+'/runtime-observation.json',JSON.stringify(observation,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(observation))
