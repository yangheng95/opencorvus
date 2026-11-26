# 后续修订与历史产物证据

本人在原 Mission 页面提交区域 CSV 后续需求，产品正常新建并完成一个真实 Task。12 项实际测试、命令及特殊字符/排序检查通过；旧四文件和新五文件均返回对应原字节，七次真实浏览器下载核对通过。同时补齐单文件预览缺少原快照标识的来源信息。没有发现或宣称修复字节串版。根因、方案和范围见[规格](../../records/2026-11/2026-11-27-followup-artifact-version-identity.md)。

- [旧四文件修改前读取](baseline-read.json)、[实际 12 项测试、命令、排序结果及新旧字节/七次下载核对](version-check.json)、[候选九次原资源读取及实际资源包](candidate-read-check.json)、[真实点击来源与时间](download-clicks.json)。浏览器自动命名的新旧报告分别为 `销售报告 (1).md` 1408 字节和 `销售报告 (2).md` 1113 字节；原文件没有覆盖。
- [真实 Task 完成事件/决定、原已完成 Task、Mission 最终回复与完成工具事实](task-and-mission-facts.json)。示例自身提交为 `f7bf091156c9b137c4eb3d5b822721294e9a8f24`，未推送；它不是 OpenCorvus 修复提交。
- [请求汇总](model-request-summary.json)、[原任务运行 68 次审计](run3-model-request-audit.json)、[候选查看预检 2 次审计](run4-model-request-audit.json)：70 次精确 GPT-6.1 Sol 流式请求，均 HTTP 200，来源读取全部到 EOF（流结束）并结清。候选只复用同一完成事实，未再次执行 CSV 功能需求。
- [任务服务收据](run3-runtime.json)、[候选收据](run4-runtime.json)：两个原进程句柄已结清，退出码 0，凭据与模型目录配对副本已实际移除。[类型检查](overlay-types.log)、[构建输出](overlay-build.log)均成功；构建日志仅整理行尾空格，第三方及体积提示保留。

以下原截图均由本人实际查看，不是自动截图测试、截图基线或像素断言：

- [真实后续输入](run3-followup-submitted.png)、[实现与产品独立审查进展](run3-followup-progress.png)。
- 修复前：[旧同名报告信息](run3-old-report-before-revision.png)、[新同名报告信息](run3-new-report-before-source-label.png)，二者均只有类型、大小和校验值。
- 修复后：[新报告原快照](run4-new-report-source-zh.png)、[旧报告原快照](run4-old-report-source-zh.png)、[英文来源字段和完整旧报告](run4-old-report-source-en.png)。
- [CSV 真实表格原值](run4-regions-table-zh.png)、[实际按数值升序后的视图](run4-regions-numeric-sort-zh.png)；排序后的预览再次导出的原 CSV 仍与原交付行序及字节一致。

本轮实页覆盖当前真实直接文件入口、同名报告、CSV 视图与原件下载。两个真实任务的交付记录均为单文件资源，没有为测试另造整份快照发布；整份快照浏览器未单独作本轮视觉覆盖，其既有字段布局保留，来源取值与调用变更已作代码复核。
