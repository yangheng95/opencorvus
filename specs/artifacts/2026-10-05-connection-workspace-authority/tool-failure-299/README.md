# 299 工具失败摘要修复

[Recall和根因分析](../tool-failure-plan-299.md) · [月记录](../../../records/2026-10/2026-10-11-tool-failure-299.md)

真实网页读取404时，展开正文正确读取结构化failure，但公共摘要漏读，选择了format参数而显示markdown。摘要与正文现在共用同一失败展示函数，保留原始输入及完整Details。没有工具名称特判，没有新协议或并行状态源。

## 实际界面证据

- 原行为：[298真实截图](../live-child-298/live-01/03-sources-reading.png)及[持久化请求/失败](../live-child-298/live-01/canonical-current-conversations.json)。
- 修复：[活动预览](history-01/01-failure-summary.png)、[失败正文](history-01/02-expanded-error.png)、[原始输入](history-01/03-input-and-diagnostic.png)、[完整诊断](history-01/05-diagnostic-visible.png)。
- [宽侧栏来源和失败摘要](history-01/09-wide-sources-and-failure.png)、[键盘展开](history-01/10-keyboard-reopen.png)、[实际W3C目标页](history-01/11-source-destination.png)。
- 04的外层没有滚动，因为指针在独立输入区；07没有调整宽度，因为拖拽起点在一像素分隔条外。二者保留观察过程，实际键盘调整及结果见08—10。

截图均由root在完整原历史的真实开发/ui操作并人工查看。主页面的模型配置提示来自明确无凭据的历史验收副本；未向Provider发请求，也没有新Task或成员。

## 运行与数据保管

[启动资格](readiness/admitted.json)、[完整90表复制](history-01/tool-failure-299-history-01-history-copy.json)、[最终完整事实检查](history-01/final-canonical-custody.json)、[原exec5991实际join](history-01/original-exec-joined.json)、[原生闭合](history-01/tool-failure-299-history-01-native-host-settled.json)、[独立复核](history-01/closure-readback.json)。

权限检查器已区分8次成功结果与1次实际失败终态；旧检查错误保留在说明中。[Git索引原始差异](history-01/project-observation-prj_henwry6SsjtljpGkako9.json)与[原检查点/真实Git观察](history-01/index-observation.json)证明四个暂存路径、模式和blob身份与原任务结果tree一致。未回写时间、删记录、改schema或重启用户进程。

类型和构建通过；文档与提交检查见对应日志。原实时Rendering闪烁仍未解决，本轮范围是已复现的失败摘要错误。
