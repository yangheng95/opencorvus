import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {ownedJSON} from '../source-reconnect-history-535/http-json'
const root=import.meta.dir,stage=process.argv[2];assert(['before','after'].includes(stage))
const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8')),run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-'+stage
const proof=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8')),host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
assert.equal(proof.preflight.credential,'usable');assert.equal(proof.preflight.catalog,'projected');assert.equal(proof.preflight.actualModel,plan.model);assert.equal(proof.maxRequests,plan.maximumRequestsPerStartedScope)
const requestID=randomUUID(),origin='http://127.0.0.1:'+plan.ports[stage]
const common=`先仅实际读取自己的第一个指定入口一次，读取完成后用约150中文字的可见正文准确报告此次返回的材料身份与证据边界。随后仅实际读取自己的第二个指定入口一次，再报告第二次返回的材料身份，最后在同一会话assistant正文输出约3500中文字、八节的原创《来源与长文阅读说明》。八节标题依次为“## 第一节”至“## 第八节”，包含连续长段落、列表、一张至少八行的Markdown表格与一个纯文本围栏；内容用于外部操作者阅读排版，区分真实来源事实、工具结果与一般写作说明，不虚构论文结论、实验或界面验收。第一节包含一个引用式演示链接，文末再定义为https://example.com/，只排版、不访问。用该成员自己的BEGIN/END标记划清正文范围。每入口只一次，失败如实说明，不重试、不扩大搜索；正文只可见输出，不生成文件或其他Artifact。`
const request=`这是一个有限的隔离产品体验Task。Base任务所有者把下面A、B两项互相独立、无前后依赖的只读责任在同一个就绪前沿并发交给两个真实Base Researcher产品成员，各保留真实会话、工具、来源、权限和最终正文。开发和人工UI观察由外部单一操作者完成；这些产品成员不操作、检查或宣称验证UI。
A责任：第一入口 https://arxiv.org/abs/2509.11035v1 ，第二入口 https://arxiv.org/html/2509.11035v1 。${common} A标记为LIVE537A_BEGIN与LIVE537A_END，引用式标识live537-a。
B责任：第一入口 https://aclanthology.org/2025.naacl-long.475/ ，第二入口 https://aclanthology.org/2025.acl-long.195/ 。${common} B标记为LIVE537B_BEGIN与LIVE537B_END，引用式标识live537-b。
两成员各只承担该责任，可以读取当前真实Task/派发记录理解来源身份，但不读写用户文件、不执行shell、不创建Task/Mission/持续目标或其他成员，不增加网站/搜索责任。所有模型和helper沿用当前配置gpt-6.1-sol流式。任务所有者等待两位原成员自然结束，直接读取真实最终正文与工具事实，只给简洁完成/未达摘要，并依据当前Task结束合同自然收敛；不代写他们的正文，不声称人工视觉验收通过。`
const body={requestID,productPillar:'work',title:'双成员来源与正文追加 537',source:'live-task-source-growth-537',promptProfile:'base',request,model:'openai/gpt-6.1-sol'}
const url=new URL(origin+'/global/tasks')
fs.writeFileSync(root+'/'+stage+'-task-create-request.json',JSON.stringify({url:url.href,sentAt:new Date().toISOString(),body,maximumProviderRequests:plan.maximumRequestsPerStartedScope},null,2)+'\n',{flag:'wx'})
const value=await ownedJSON(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},host.deadlineAt)
fs.writeFileSync(root+'/'+stage+'-task-create-response.json',JSON.stringify({status:value.response.status,result:value.result,receivedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
assert.equal(value.response.status,202);assert.equal(typeof value.result.task_id,'string');assert.equal(typeof value.result.directory,'string')
assert(value.result.directory.replaceAll('\\','/').startsWith(run+'/runtime/data/projects/'))
console.log(JSON.stringify({status:value.response.status,taskID:value.result.task_id,projectID:value.result.project_id,directory:value.result.directory,requestID,url:origin+'/ui/?taskID='+encodeURIComponent(value.result.task_id)}))
