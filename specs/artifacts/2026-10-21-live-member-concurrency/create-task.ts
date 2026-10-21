import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const root=import.meta.dir,stage=process.argv[2];assert(stage==='before'||stage==='after')
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/live-member-concurrency-508-'+stage,origin='http://127.0.0.1:'+(stage==='before'?18925:18927)
const proof=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(proof.preflight.credential,'usable');assert.equal(proof.preflight.catalog,'projected');assert.equal(proof.preflight.actualModel,'gpt-6.1-sol');assert.equal(proof.maxRequests,32)
const requestID=randomUUID()
const request=`这是一次有限的产品内双成员并发来源与长文阅读体验。当前Base任务所有者负责把下面A、B两个互相独立、没有前后依赖的只读责任在同一个就绪前沿并发派发给两个真实Base Researcher成员；两项必须分别保留自己的真实可见会话、原工具和来源，不把两项合并成同一个成员，也不再分派其他成员。这里的成员是被观察的产品能力，开发和人工体验由外部操作者自己完成，不要求任何成员操作、检查或声称验证UI。
成员A的完整独立责任：只实际读取 https://arxiv.org/abs/2509.11035v1 一次，确认页面入口与材料身份；读取后立即用一句真实可见状态说明成功/失败和证据范围。随后在同一会话最终assistant正文写约2500中文字、8节的中文《来源A与长文阅读说明》，用于操作者观察排版。开头单独写LIVE508A_BEGIN，8个节标题依次使用“## 第一节”至“## 第八节”，有完整长段落、列表、一张不少于8行的Markdown表格及一个纯文本代码围栏；不是论文结论，不虚构实际界面操作、实验、作者观点或独立验证。第一节包含[演示阅读入口][live508-a]，第八节后空行再定义[live508-a]: https://example.com/，最后单独写LIVE508A_END。该演示链接只用于排版，不访问。区分原文、来源、真实工具结果与通用展示建议。只在可见正文输出，不压缩进工具字段、不生成报告文件或额外研究Artifact。来源失败则如实保留失败，不重试或扩大搜索。
成员B的完整独立责任：只实际读取 https://aclanthology.org/2025.naacl-long.475/ 一次，确认页面入口与材料身份；读取后立即用一句真实可见状态说明成功/失败和证据范围。随后在同一会话最终assistant正文写约2500中文字、8节的中文《来源B与长文阅读说明》，用于操作者观察排版。开头单独写LIVE508B_BEGIN，8个节标题依次使用“## 第一节”至“## 第八节”，有完整长段落、列表、一张不少于8行的Markdown表格及一个纯文本代码围栏；不是论文结论，不虚构实际界面操作、实验、作者观点或独立验证。第一节包含[演示阅读入口][live508-b]，第八节后空行再定义[live508-b]: https://example.com/，最后单独写LIVE508B_END。该演示链接只用于排版，不访问。区分原文、来源、真实工具结果与通用展示建议。只在可见正文输出，不压缩进工具字段、不生成报告文件或额外研究Artifact。来源失败则如实保留失败，不重试或扩大搜索。
两成员都只承担各自这一项责任，可以读取当前Task/派发的真实工具与参与者记录以理解来源身份，不读写项目或其他用户文件，不执行shell，不创建子Task、Mission或持续目标，不增加其他搜索、网站或工具责任。所有模型与内部helper沿用当前已配置gpt-6.1-sol流式，不切换或使用非流式。平台正常Task/工具/生命周期事实保持完整可见。任务所有者等待两位真实成员的最终事实，再直接读取他们的真实最终回复和工具记录，给出简洁完成/未达摘要并依据现有Task结束合同自然收敛；不重写他们的长文、不声称操作者的人工验收通过、不把他们的自述当独立验证。`
const body={requestID,productPillar:'work',title:'双成员并发来源与长文 508',source:'live-member-concurrency-508',promptProfile:'base',request,model:'openai/gpt-6.1-sol'}
fs.writeFileSync(root+'/'+stage+'-task-create-request.json',JSON.stringify({url:origin+'/global/tasks',sentAt:new Date().toISOString(),body,maximumProviderRequests:32},null,2)+'\n',{flag:'wx'})
const response=await fetch(origin+'/global/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/'+stage+'-task-create-response.json',JSON.stringify({status:response.status,result,receivedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
assert.equal(response.status,202);assert.equal(typeof result.task_id,'string');assert.equal(typeof result.directory,'string')
assert(result.directory.replaceAll('\\','/').startsWith(run+'/runtime/data/projects/'))
console.log(JSON.stringify({status:response.status,taskID:result.task_id,projectID:result.project_id,directory:result.directory,requestID,url:origin+'/ui/?taskID='+encodeURIComponent(result.task_id)}))
