import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before',origin='http://127.0.0.1:18889'
const proof=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(proof.preflight.credential,'usable');assert.equal(proof.preflight.catalog,'projected');assert.equal(proof.preflight.actualModel,'gpt-6.1-sol');assert.equal(proof.maxRequests,12)
const requestID=randomUUID()
const request='这是一次真实但范围有限的产品说明交付。请只由当前 orchestrator 独立完成，不委派 agent/worker、不创建子 Task、Mission 或持续目标，不访问网站、不运行 shell 命令、不读写本任务新项目以外的用户文件。请在这个新任务项目中实际编写两份简短中文说明：docs/continuous-goal.md 说明首页“创建持续目标”、确认后才创建会话、可选预算、暂停/完成的区别，以及修复阻塞后显式恢复；docs/deliverables.md 说明右侧“交付成果”的合同/验收含义、#G 技术编号，并区分它与跨轮次持续目标。把这两个明确文件成果各自记录成可验收交付合同，标题简洁，目标与验收标准具体，文件路径就是上述真实任务要求的路径。使用现有通用文件工具实际写出正文，内容只依据本请求给出的界面事实，不声称操作过界面或已经通过人工验收。保留真实工具、审批和结果。最后在对话中给出交付摘要和已验证/未验证事项，依据实际证据走原 Task 结束合同；若无法完成请明确原因，不伪造验收通过。'
const body={requestID,productPillar:'work',title:'持续目标与交付成果使用说明 501',source:'real-deliverable-review-501',promptProfile:'base',request,model:'openai/gpt-6.1-sol'}
fs.writeFileSync(root+'/task-create-corrected-request.json',JSON.stringify({url:origin+'/global/tasks',sentAt:new Date().toISOString(),body,maximumProviderRequests:12},null,2)+'\n',{flag:'wx'})
const response=await fetch(origin+'/global/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/task-create-corrected-response.json',JSON.stringify({status:response.status,result,receivedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
assert.equal(response.status,202);assert.equal(typeof result.task_id,'string');assert.equal(typeof result.directory,'string')
assert(result.directory.replaceAll('\\','/').startsWith(run+'/runtime/data/projects/'),'Actual public global Task must own its private runtime Project')
console.log(JSON.stringify({status:response.status,taskID:result.task_id,projectID:result.project_id,directory:result.directory,requestID}))
