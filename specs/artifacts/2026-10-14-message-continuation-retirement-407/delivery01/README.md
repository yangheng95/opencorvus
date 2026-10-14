# 407 实施与真实运行证据

[Recall与完整方案](../../../records/2026-10/2026-10-14-message-continuation-retirement-407.md)、[精确原件/选择清单](manifest.json)。560条清单中9条明确排除，551份实际文件共10,515,185字节；4张JPEG为原图，其余gzip解压后为原bytes或明确标注的HTTP配置元数据选择。压缩往返只检查档案完整，不是源码摘要或功能验收。

生产只有Session唯一Message writer与Permission原退休实现两处改动。正常完成、silent、相同不可变完成重放、bundle/atomic/import按原事务退休；真实Session Project决定候选，写错传播并保留原错误，早前真实Tool/result保持。没有schema/授权复用/Question/Provider策略变化。

| 实际最终检查 | 去重结果 | 原回执 |
| --- | --- | --- |
| 聚焦writer与Message settlement | 20 tests / 130 assertions | [focused-green03 owner](implementation/focused-green03/owner.json.gz)、[完整stderr](implementation/focused-green03/stderr.log.gz) |
| 实际共享进程与效果恢复 | 4 / 58，8原child完整闭合 | [正式owner](implementation/process-green01/owner.json.gz)、[原完整场景总结](implementation/process-green-summary.json.gz) |
| 公开no-waiter终态回复 | 1 / 22，实际SQL退休500→解除故障原unresumable+stale | [原owner](implementation/public-reply04/owner.json.gz)、[真实服务端原因](implementation/public-reply-evidence04/actual-reply-server-error.json.gz)、[原恢复事实](implementation/public-reply-evidence04/recovered.json.gz) |
| 关联六原绿文件与出版单文件补验 | 37 / 145 | [原related01 stderr](implementation/related01/stderr.log.gz)、[真实回调补验](implementation/related-tool-publication02/stderr.log.gz) |

合计11个selected文件、62不同tests/355assert。原红/误期待/错误输入及修正全部单独保留，不能把related01整体exit1或前三公开exit1改绿。[最终backend范围交接](implementation/final-handoff.md.gz)、[全部原工具joins](implementation/original-exec-joins.json.gz)、[Root原joins](root-original-exec-joins.json.gz)说明确切验收层级与闭合。[出版等待横审](implementation/related-publication-wait-review.md.gz)保留原DB idle与独立Bus publication owner的合同，补验实际读取完整Tool/Source，未改产品Bus。

Root真实桌面使用当前开发源码的普通native服务及私有当前UI bundle，访问localhost `/ui`，亲自点击AllowOnce；截图人工复核原Tool/Source和自然回复。第二独立Sol轮所有5次实际gpt-6.1-sol流式请求EOF，原NativeService资格exit0，public shutdown/physical/output/request和auth/models配对退休完成。两轮共11次请求，原累计上限20；第一轮一次真实read ECONNRESET导致原资格exit1，随后同活动retry自然完成，原失败保持。

- 首轮：[批准前原图](sol-manual01/01-before-approval.jpg)、[自然完成原图](sol-manual01/02-natural-completion.jpg)、[安全物理审计选择](sol-manual01/provider-evidence-whitelist.json.gz)。
- 第二轮：[批准前原图](sol-manual02/01-before-approval.jpg)、[自然完成原图](sol-manual02/02-natural-completion.jpg)、[原资格](sol-manual02/message-retirement-407-replay01-qualified-surface-completion.json.gz)、[物理闭合与配对清理](sol-manual02/message-retirement-407-replay01-physical-terminal-and-pair-cleanup.json.gz)。
- [两轮公开业务事实核验](sol-business-evidence.json.gz)检查原Session/Project/request/call/attempt/Source与五事件、真实完成/退休时间和conversation身份；这是已捕获API核验，未运行UI自动化，也不代人工语义或新模型轮。[首轮共享retry只读审计](audit/stream-retry-readonly.md.gz)明确reset发起者与该轮SQL activity outcome仍未知。

删除18个已检索UI自动化例及专用fixture，保留1个原纯prepare数据错误契约；[完整删除差异](ui/ui-test-removal/final-diff.patch.gz)。未运行这些UI测试。Core types、正式module1163/5936/4clean imports和当前UI构建原过程在`checks/`与`implementation/types01`；构建不代视觉。

[下一批grant投影审计](audit/grant-projection-408-analysis.md.gz)、[raw客户端边界](audit/raw-permission-adapters-408-analysis.md.gz)是只读候选，没有408实现或旧库迁移验收。Task/Mission自然业务终态、Question、真实远端MCPtask、已删owner/转移Project和live/unknown Sol effect均未由本批闭合。

没有auth/models内容、runtime数据库、私有bundle或完整Sol Provider正文。原process HTTP的`/global/config`body明确减少为原准入metadata，8份config整件与含完整controlled Provider请求的related01 stdout均排除；manifest逐项记录，未伪称完整保留。最终Git提交与push回执由下一批承接，不将本页当作已发布证明。
