# Sources 与成员历史首开证据

见[Recall、分析与结果](../../records/2026-10/2026-10-22-source-cold-history.md)。单agent、两个零模型隔离实例、10张真实页面截图人工复核；修正私有诊断日志级别及冻结资源的交付方式，没有生产代码变更。

- [首开实图](03-first-member-warning.png)：前一AX曾出现Rendering，紧接截图已是正文。300条有效事件核对32个真实正文owner和10个Source行owner；首批HTML最长等待约822.2ms，全部正文完成约1553.1ms。该时长不是视频逐帧测量或全局性能保证。
- [成员列表](04-member-list.png)、[键盘返回详情](05-member-detail-return.png)：维持原正文/Source生命周期。
- [来源阅读](06-source-reading-warning.png)、[关闭dock](07-dock-closed.png)、[重开Sources](08-dock-reopened-source.png)：阅读位置保持60433.33203125，正文和来源身份保持。
- [展开原工具结果](09-tool-result-expanded.png)、[收起后来源](10-source-after-tool-close.png)：Raw/Output是原真实结果，原文及邻接Sources保留；不冒充多来源/source excerpt展开资格。
- [资源摘要](resource-summary.json)及两个`*-physical-terminal.json.gz`：原服务74665/62275 join0、public shutdown200、物理/output/request/launcher/精确出生闭合，137/138关闭；模型0/0，auth/catalog副本0。实际加载debug main-CTpky2aj.js与warning main-x2RfaWHp.js，两者同生产源b8d6349b8。
- `after-console-first.json.gz`/`after-console-final.json.gz`保留原warning事件；`result-observation.json.gz`包含分owner时间线与各真实动作后的日志窗口。首窗294，最后6条历史渲染完成后300，其余动作窗口保持300。body-mount与body-state的同初始空态不能算两次闪烁。
- `before-console-first.json`原debug收集为空；诊断DOM标记存在。原debug builder及两次Node build log保留；运行中重建不会改变服务的冻结资源，因此新warning代码只在第二个实例实际观察，after不是生产修复资格。
- 两个scope服务日志各9条原ProviderModelNotFoundError及其投影保留；原因是本批不投影Sol catalog的明确零权限隔离，不能误报用户凭据失效或把服务日志写成0。浏览器error收集为0。
- `data-preservation-observation.json.gz`核对完整90表163200原行、源bytesmtime/schema3/完整canonical；两目标原行差异0，Provider activity407→407。全DB/全行快照、完整AX/原工具网页输出及凭据不归档。Helpers提供本批准备、原生监督与只读检查来源，依赖既有成熟私有链，不是UI自动化测试。

本批仅排除观察路径中的重复owner重建。重连/回放/历史补齐、虚拟窗口、其他生产入口及流中组合仍需调查，Sources/Rendering整体目标保持开放。
