# 活跃成员并发与来源呈现

2026-10-21开始、2026-10-22完成，单Codex开发agent。按[启动前方案与逐次调查](../../records/2026-10/2026-10-21-live-member-concurrency.md)真实体验两个产品成员；未委托Codex子agent。产品源码未变，本轮修复私有生命周期观察器，并回到原实际检查链重验。

## 实际资格

| 范围 | 真实结果 | 证据 |
| --- | --- | --- |
| before18925 | Task tsk_g00VYhSxsK00wBhBLEmN自然完成，14/32次请求；两成员长文reader重叠68030毫秒 | [原Provider读取端](before-provider-description-private.json)、[结算](before-physical-terminal-and-pair-cleanup.json) |
| 正式18929 | 同一已完成Task、实际DOM（Document Object Model，文档对象模型）script为main-BZjSJ4zp，A→B标签/来源/正文一致；0模型 | [实际来源图](12-actual-formal-b-source.png)、[原结算](formal-physical-terminal.json) |
| after18927 | 新Task tsk_g00VYhVoHG009opnUqaV自然完成，15/32次请求；两成员长文reader重叠66452毫秒，活跃A→B、列表往返、调宽、隐藏/重开实测 | [原Provider读取端](after-provider-description-private.json)、[结算](after-physical-terminal-and-pair-cleanup.json) |
| 数据 | 三scope各90表；原源全部字段/rowid或主键/时间、源bytes/mtime、完整canonical、schema3/实际对象/integrity保持。两有模型副本各三行容量租约正常替换，零模型正式副本全部原行相同 | [逐表描述](data-preservation-observation.json) |
| 安全收尾 | 实际29/64，未用35退休；全部stream=true、gpt-6.1-sol、HTTP200、原reader EOF（End Of File，读取结束）。两scope原生物理/输出/请求/launcher结算，runtime及新私有源auth/models八个副本成员全部退休 | [范围清单](scope-disposition.json)、[before授权退休](before-authority-retirement.json)、[after授权退休](after-authority-retirement.json) |

预检分别真实确认凭据可用、完整模型目录投影和实际请求模型一致，包含所有helper、记忆与标题请求。原用户18571进程、窗口、数据库没有操作。没有清库或结构迁移；自然新Task/Message/工具/生命周期记录只进入隔离副本。未更改版本、发布或创建分支。

## Rendering与诊断根因

初轮选择B后显示A，并记录Solid cleanNode清理重入及继发的缺少Dock布局owner错误。旧私有observer在dispose时仍读props.text/frozenHtml/pending，可能重新计算正在清理的上游memo。正式包加载的11/12图切换正确；修正observer后相同实际活跃切换正确，原失败原样保留，未据诊断污染改产品。

修正只在正常state/mount阶段缓存事实，dispose只输出最后缓存的事实与清理时刻。清理日志的textLength/blocks是**最后正常观察值**，不表示在清理阶段重新测量。[当前诊断构建器](build-diagnostic.mjs)以正式Node/Vite配置构建，只被动记录身份/块状态；不改正文、数据、HTML（HyperText Markup Language，超文本标记语言）或帧调度。

[9次窗口与866条事件](after-console-description.json)保留document时间命名空间。切换真实目标时，A的owner13–15正常退休，B的owner16–18新建；B同目标在列表、调宽380→440、隐藏/重开期间保持原Session/Message/Part绑定，长文由0到33块。每个新owner只观察到首次pending且0块，后续采样保留已呈现块；未据采样声称逐帧无闪烁。500条窗口均与前次重叠，初始事件在前次原console文件中保留，没有只用末500条冒充全部。

页面刷新产生新document及owner34–36，但B原Session/Message/Part不变，最终33块及末尾标记可读。刷新前两成员正文已完成，Task仍在运行；本轮覆盖Task活跃刷新恢复，**未覆盖成员正文流中刷新、同文档传输断连重连、连续视频或所有Sources类型**。

## 人工图与误操作边界

全部23图均已实际呈现并人工查看；截图不是UI（User Interface，用户界面）自动化断言。

| 图片 | 实际含义 |
| --- | --- |
| 01–05 | 初轮派发、审批、A真实来源/工具展开与活跃长文 |
| 06–07 | 初轮诊断故障，B选择title但旧A标签/正文；不是通过图 |
| 08–09 | 原Task活跃刷新及恢复；此时成员已完成 |
| 10 | 磁盘正式包重建后原服务仍返回冻结的旧诊断字节，不能算正式包资格 |
| 11–12 | 独立零模型服务实际正式包的A→B正确切换与B来源 |
| 13–14 | 修正observer后真实活跃A/B来源、正文、独立身份 |
| 15–19 | 活跃列表往返、调宽、暂停阅读表格、隐藏/重开，同位置可读 |
| 20 | Task活跃刷新后恢复真实完成审批 |
| 21 | Task终态更新导致旧数字索引失效，实际只滚动Main，不能算B来源图；随后重新定位真实按钮 |
| 22–23 | 刷新后准确打开原B，真实来源及完整长文尾部 |

示例：[活跃B](14-after-b-live.png)、[调宽](16-after-b-widened-live.png)、[重开后表格](19-after-dock-reopened-live.png)、[恢复来源](22-after-refresh-b-source-actual.png)、[完整尾部](23-after-refresh-b-tail.png)。图片中的论文内容是原模型叙述，UI验收依据为实际操作/图片/原始消息和工具事实，不以模型自述代替人工验证。

## 构建、辅助运行器及交付

三构建原54850/30836/22384分别完成53.56秒/1分11秒/47.71秒，未作为性能指标。源服务冻结静态资源字节，重新构建磁盘文件不会更换已运行服务的UI；没有修改该真实资源合同。正常正式包必须在独立新服务启动后核对实际script，10图的误判已纠正。

零模型辅助首个执行因旧helper的端口/根目录断言exit1，随后复制日志因尚未生成日志文件失败；[原native失败结算](formal-first-failed-native.json)保留。当前owned helper按实际新范围修正后，原48899正常启动，读取/切换/截图、公开shutdown200及physical/output/request/launcher全部结算；不把旧失败抹除为通过，也未增加模型预算。

这里保留原观察、脚本和结算元数据，不保留全库私有dump、数据库、完整运行日志、凭据或模型目录。脚本记录原.tmp-product-iteration工作位置及本机输入路径，非自包含发布工具；实际验收已经进入真实源码CLI（Command Line Interface，命令行接口）开发模式/ui，未单起Vite，未运行UI自动化测试。

文档检查、架构索引及正常push hooks另见检查记录；不存在UI产品修复提交。完整149目录配置保存10秒/恢复5秒、Rust父依赖图及未实测矩阵继续保留，长期Goal active。
