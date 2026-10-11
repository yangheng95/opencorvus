# 322 前段可见正文读取与真实 Sources 阅读

2026-10-12；单agent开发。方案及限制见[Recall](../worker-narration-plan-322.md)。本批有后端读取能力修复，没有修改前端代码；截图来自正常开发 `/ui` 的真实 Task，前端使用320构建。

## 实际结果

[真实读取核验](real-reader-verification.json)对照[规范消息与工具输出](live-01/canonical-current-conversations.json)：Task `tsk_g00VXmjqDl00GCczWitJ` 仅派发一次 `base-researcher`，一个已接受输入轮次中产生487字符开场、3037字符第1–6节、3603字符第7–12节。负责人先读最终报告及统一Part目录，再以最终来源为锚，一次读取两项text和两项Tool的input/output；两段text与原始Part逐字一致，六个chunk均完整。本次负责人直接完成任务，未再要求合并正文。

[输入和实际输出摘要](observed-stream-and-narration-reads.json)、[原始任务要求](request.txt)、[完整流式观察](live-source-observation.json.gz)均保留。Task在3分9秒完成；10次实际`gpt-6.1-sol`请求均为流式HTTP200/EOF（含预检）。5343个公开Task事件、4个Source更新、5个观察到的text字段最终与规范存储一致。观察器从真实`after_live=0`入口订阅，不宣称覆盖订阅前全部正文，也不把后端事件比较冒充逐帧视觉验收。

运行 `node specs/artifacts/2026-10-05-connection-workspace-authority/worker-narration-322/verify-results.ts` 的实际结果已保存；脚本验证真实规范事实，不调用UI。其结果文件使用独占写入，复核时用第二个命令行参数指定新的输出文件，不能覆盖历史验收。

## 人工视觉

- [01](screenshots/01-attempt-followed-live-tail.png)：首次尝试点击时仍跟随后文，Sources未成功展开；不计为成功。
- [02](screenshots/02-expanded-while-generating.png)：主动回到可见来源组并展开，Task1分8秒，第3节仍在生成。
- [03](screenshots/03-reading-during-later-text.png)：保持阅读，Task1分35秒，后文已增加到第6节；来源展开和截图中的位置保留。
- [04](screenshots/04-reading-across-web-source.png)：Task2分43秒，研究员第12节及引用说明已生成，来源组仍保持可读。该帧不声称研究员此刻仍在流式输出。
- [05加载阶段](screenshots/05-exact-source-line.png)与[06加载完成](screenshots/06-loaded-source-line.png)：真实点击第4行来源；完成加载后编辑器选中第4行。
- [07返回侧栏](screenshots/07-reopened-source-reading.png)：Source组仍展开，回到邻近阅读区域；不声称跨面板恢复为完全相同像素位置。
- [08网页来源](screenshots/08-web-source-and-later-body.png)：真实W3C来源标题、域名与后六节正文正常呈现。

这些是人工操作与人工查看的截图样本，没有UI自动化测试或逐帧断言。采样期间没有看到重复Rendering占位；这不是全时段零闪烁证明。

## 退出与证据边界

原启动执行器19409、流观察器25279均actual exit0；Native43208、Host75784通过原生产ProcessFacade物理退出及输出drain，端口18292释放，复制的auth/models配对清理，tab92关闭。原始终态、Provider请求及清理记录在[live-01](live-01/worker-narration-322-live-01-physical-terminal-and-pair-cleanup.json)。runtime日志完整脱敏后压缩，原记录私有保留。

后端聚焦测试与类型检查、原失败夹具日志见checks目录及月度记录。旧fixture缺少物理终态、错误Session种类和事后追加已冻结输入的修复过程属于检查器数据修正，不是实际产品调度失败。此次旧目录被统一Part合同替换，未保留旧字段别名；未改调度器、生命周期或终态权限。
