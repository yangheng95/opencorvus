# 321 真实子侧栏与分段正文读取缺口

[实施前 Recall](../source-child-stream-plan-321.md)。单开发agent；被测产品只安排同一名base-researcher，基线9f5ac34ec27796007cddc1e82ed86e7074e9a836。本轮无生产代码改动，实际证据确定了下一项应修复的共享读取能力。

## 真实运行

正常开发/ui18291，Task为tsk_g00VXmYPuV00oCT9bk7m，Project为prj_hv2cD5rLzbARpqqMsDGX，Researcher Session为ses_hu2FUdtPs2AFVV0uocmg。授权凭据和完整models成对，分别预检usable/projected/实际gpt-6.1-sol流式。输入文件source-review.md由验收准备阶段创建，模型仅搜索其第2–4行，并实际webfetch指定W3C页面。

首次工作执行的三个真实assistant Message依次含420字符开场、2988字符的第1–6节、3507字符的第7–12节及引用限制，共6915字符。三者有相同parentID，前两条finish为tool-calls，最后一条为stop；都完整保存在canonical（规范持久化）事实中。

Task最终完成于22:23:51 UTC，耗时约4分38秒；公开事件观察器收到10,365个事件、4个Source更新。8条text字段的分片连续；7条流末尾值与canonical完全相等，另一条负责人短开场90→89字符对应processor既有trimEnd规范化。不能把它称为丢字，也不能以该数据检查替代页面生命周期证据。

## 页面资格和未完成项

- 01-active-child-intro.png：真实子侧栏持续生成，已出现三个文件来源与正文第一节。
- 02-active-child-later-body.png：后半段实际生成至第8–9节，已渲染正文保持可读；画面没有显示文件Sources展开，不能把文件名或早先点击意图当成验收成功。
- 03-completed-file-sources.png：任务完成后，三个文件来源成功展开且可辨认。
- 04-child-file-line-open.png：点击第4行来源，真实编辑器选中对应内容。
- 05-reopened-child-reading.png：关闭Dock并重新选择子面板后仍在同一组文件来源附近，保持展开；不宣称像素位置完全相同。

五张截图均已实际呈现并人工查看。两张流式采样中没有复现正文反复退回Rendering，但少数帧不能证明整段运行每一帧稳定。最初浏览器定位器把原生summary当成button查询而未命中，之后的旧AX索引点击也未完成展开；只读DOM（Document Object Model，文档对象模型）核对后，用实际summary定位器才成功，此时首轮Researcher已经结束。故“边生成边展开并停留阅读来源”仍未达成，不将工具操作失误包装成产品通过或故障。没有新增或运行UI自动化测试，没有注入任何消息或来源。

## 确认的共享读取缺口

负责人首先以已物理结算的最终Message读取dispatch_result，工具只返回3507字符的最后一条正文。它随后将前两条Message也作为dispatch_result来源，收到明确错误：“不是已物理结算的worker final”。再次保留正确final来源后，能读取早两条Message里的search_code/webfetch输入输出，却仍不能取得其420+2988字符正文。负责人随后通过一次capability_search寻找读取入口，最终要求同一Researcher续轮把完整正文重写进一个final Message，新增7097字符，第二轮后才完成核对。

该判断有代码与实际请求双重依据：read-agent-message.ts的messages只投影selected final的text；causal inventory只收集Tool Parts；EvidenceRead.field和实际chunk读取仅支持input/output/failure。终态来源校验本身正确，不应放宽成任意Message。缺口是：已结算worker执行轮次里较早的可见正文没有可发现、可读取的有界入口。这影响所有采用分段正文穿插工具调用的Task审阅者，不是Research Studio特例，也不是仅凭模型自述判定的偶发问题。

observed-stream-and-read-gap.json保留首轮各Message的parentID、时间、正文长度与章节、四次read_agent_message请求/结果、两次真实dispatch及流/canonical对照。完整原始脱敏对话和结果在live-01。第二次dispatch是负责人显式要求的续轮，不是引擎自动重复调度；物理终态和Task收尾均正常。因此下一步应修共享读取契约，并保留既有Task/项目/执行轮次/终态边界，不能绕过权限或让worker总是重写全文。

## 收尾与工具修正

初次CLI创建因只设置OPENCORVUS_TEST_HOME、缺少OPENCORVUS_TEST_PROCESS_ROOT而在环境校验退出。补齐绝对隔离根后复用同一requestID重跑，保留task-create.log、retry-sent.json与成功日志，只有一个实际Task被接受；不把前次命令失败当凭据故障。没有重启已运行的原服务。

公开SSE观察器原71983实际exit0；Task启动原96449实际exit0，资格含精确Task终态与15次gpt-6.1-sol流式200/EOF（End of File，流结束）。页91关闭，Native73236/Host73016按出生身份结算，18291释放，复制的auth/models成对清理。26,405行本轮运行日志脱敏压缩，未知时间行0；五个本轮原生生成文件已保管。

本轮未宣称最初Research Studio闪烁全部修复。下一轮优先补齐同一settled worker occurrence（已结算执行轮次）的早段可见正文读取，再以真实Task复验无需重写的收尾，同时补足本轮未完成的流式来源阅读操作。持续goal active，继续单agent。
