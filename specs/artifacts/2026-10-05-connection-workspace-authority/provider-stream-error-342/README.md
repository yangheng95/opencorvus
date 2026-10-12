# 342 流式错误可读性

[实施前 Recall](../provider-stream-error-plan-342.md)。单 agent 实施。原失败来自341真实Provider流；当前后端契约与历史网页人工验收分别完成。

共享协议解码支持flat与nested的真实type=error事件；APIError保留可读message及结构化脱敏responseBody。activity记录provider_stream_error并保持不自动重放的终态。Main、child与Side Chat投影共用摘要/诊断读取；正文采用普通字体和可展开详情，原记录不改写。没有增加UI自动测试。

正式导入又暴露了失败消息的共同写入问题：临时开放行移除了error，却保留要求error同时存在的failureOccurrence。现在importSnapshot与persistMessage共用一个暂存函数，错误及其依附事实一并暂存，最后在同一事务写回完整原Info。schema及完成消息不可变契约未放松。

## 验证

- 后端provider-stream-error 5 tests/10 assertions、原redaction 4/20、completed-failure-write 2/4，共11项34断言通过。后者实际走数据库导入/整批写入，验证完成时间、错误归属、观察失败及正文。
- 后端、overlay、transport类型检查与docs通过；最终build产物main-B6ejkKmg.js经真实服务GET返回200。首轮错误的测试事件名与child accessor类型问题、首次导出缺orderKey、原import失败、第二次import完成但helper idle参数遗漏、首次readiness假设存在Memory文档等原日志均保留；已修正后重跑对应检查。
- [实际历史checker](checks/actual-history.json)：真实341只读导出9条消息/21 Parts，经正式importSessionData导入history-03，所有Message.Info读回相等，原UnknownError及其原JSON完整保留。首轮失败history-01和第二轮helper错误history-02不覆盖。正式导入没有带入原Memory Organizer待重试工作；新库启动前恢复表为空、7助手完成、Provider/tool/outbox均闭合。
- localhost:18319/ui实际页面126，Root已人工查看四张截图。01目标在屏幕外、02顶缘裁切，均不作为最终视觉通过；[03展开详情](03-error-details.png)和[04最终摘要](04-error-summary-final.png)完整显示目标卡片。真实鼠标展开、键盘Return折叠及双击错误图标的Copied反馈完成。
- 初始启动79751实际join exit0；Host68200/Native70672与原生输出/请求完整结算，139331ms内关闭；固定600000ms上限未改变，页面126关闭，5份本轮native pile按精确出生归档。未复制auth/models，0 Provider请求。模型配置不可用提示是该历史阅读服务故意不投影模型目录的结果，不是凭据错误。

## 限制与后续

浏览器clipboard读取返回旧303记录，不能用作本次复制内容证明；无关原文已从公开证据移入私有诊断，没有提交。343继续检查发现：writeDebugClipboard通过公共HostTransport facade，browser分支实际调用navigator.clipboard，只有desktop才调用Tauri native clipboard；不能仅凭.native方法名推断读回不一致原因。342已确认Copied反馈，实际剪贴板内容仍未验，读回差异原因未知。原checker中的推断由本段纠正，参见[343 Recall](../error-copy-plan-343.md)。

本轮没有重新制造上游过载，没有子Dock/Side Chat的实际错误发生场景，未声称这两处完成独立视觉复核。原341项目Memory状态retry_wait/pending1完整保留，整体源库没有重启。持续产品goal保持active，下一轮继续单agent。

## 最终消息权威复核

最终代码进一步保留同一Session/inputMessageID最新真实消息的完整错误，生命周期通知继续拥有状态，不能用只有摘要的字符串清空诊断。聚合重建遵守同一选择规则。overlay类型与build重新通过，最终bundle为main-DrobkXyT.js，前述main-B6ejkKmg.js属于前一版验收。

全新history-04正式导入原9消息/21 Parts，页面127由Root查看[05最终摘要](05-authority-summary.png)、[06最终详情](06-authority-details.png)，鼠标展开与Return折叠正常；这两张是当前代码最终视觉证据。实际GET bundle200、0 Provider请求，原启动57394实际join exit0，Native/Host完整结算71982ms，页面127关闭，5份本轮pile精确归档。见[最终实例checker](checks/actual-history-final.json)。实时Provider错误与生命周期事件交错没有在该历史实例中重新发生，当前验收不冒充流式交错复现；API语义/写入终态由11项后端正向检查覆盖。

343后续已在最终浏览器页面实际核验单击/Enter/Space三种复制及Ctrl+V粘贴，均为261字符摘要与完整错误包；见[343证据](../error-copy-343/README.md)。这补齐当前复制内容资格，342当时读回旧内容的原因仍未知。
