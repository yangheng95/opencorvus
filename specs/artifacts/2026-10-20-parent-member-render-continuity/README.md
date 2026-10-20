# 父会话与成员并发阅读证据

2026-10-20；[方案、根因与限制](../../records/2026-10/2026-10-20-parent-member-render-continuity.md)。单开发agent；隔离开发服务18793/18795/18797，实际gpt-6.1-sol流式调用。没有操作用户18571服务或真实用户数据库；保留全部已有QA历史。未新增、运行UI自动化测试。

## 结果

- [运行与真实流](runtime-and-streams.json)：三个原生scope各5次、共15次实际请求，均200/stream/EOF；首次及修复后正式窗口均同时匹配父/成员真实reader和未完成回复。第二窗口的原检查器遇到过期磁盘快照，未将该次等待判成双流通过。
- [渲染生命周期](render-lifetimes.json)：103条去重日志覆盖诊断窗口；侧栏scroll owner1、旧成员Markdown owner9—18和当前成员回复owner22保持身份；已接受HTML后保持非空。主区宽度变化退休owner21并新建23，与侧栏对象区分。
- [历史保留](history-preservation.json)：原139 Project/188 Session身份/目录/归属完整；最终142/191（各scope一条真实预检会话及项目），schema3。原双会话20条Message、48条Part、38条protocol及rowid逐行一致；原Session仅实际输入更新时间改变。
- [验证范围](verification.json)：3个聚焦后端文件41例/174断言通过，backend typecheck原25408 exit0。新增合同经真实本地HTTP和现有物理reader验证，另在真实Sol原检查器复验。
- [清理](private-pair-retirement.json)：原74013/19684/85274均exit0、各公开shutdown200，native/output/request物理结算后退休runtime与private完整auth/models对，源凭据元数据保持；IAB临时tab25/26/27已关闭。

## 人工截图

所有截图实际呈现并人工查看；图片不是截图基线或像素断言。01—09为被动诊断构建，10—21为当前正式472前端；本轮只修审计脚本，没有改产品UI或Markdown缓存。

|图片|人工观察|
|---|---|
|[01](01-original-source.png)|原成员read与README.md L2–3|
|[02](02-both-stream-source.png)|实际双流中的原来源段|
|[03](03-both-stream-list.png)|双流中的成员列表|
|[04](04-both-stream-return.png)|列表返回原阅读位置|
|[05](05-both-stream-reopen.png)|侧栏关闭重开|
|[06](06-both-stream-source-file.png)|来源实际文件，第2—3行选中|
|[07](07-both-stream-file-return.png)|文件返回原来源段|
|[08](08-member-live-body.png)|成员自身长Markdown当前流|
|[09](09-reading-after-body.png)|完成后回看原来源|
|[10](10-formal-original-source.png)|正式构建原来源|
|[11](11-formal-stream-source.png)|正式输出期间来源|
|[12](12-formal-list.png)|正式成员列表|
|[13](13-formal-list-return.png)|正式列表返回|
|[14](14-formal-completed-source.png)|第二窗口完成后来源|
|[15](15-verified-source-before.png)|修复审计器后正式复验原来源|
|[16](16-verified-both-stream-source.png)|原检查器确认双流时来源|
|[17](17-verified-return.png)|双流中列表返回|
|[18](18-verified-reopen.png)|双流中侧栏关闭重开|
|[19](19-verified-source-file.png)|双流中来源文件实际L2–3|
|[20](20-verified-file-return.png)|文件返回原来源及正文|
|[21](21-verified-completed-source.png)|两条实际回复正常完成后来源|

本窗口没有建立当前Rendering复发证据；截图不能排除全部瞬时帧，诊断范围也不等于Task/Mission所有并发组合。配置完整保存原冷10秒/恢复5秒性能目标仍未达到，整体迭代Goal继续active。
