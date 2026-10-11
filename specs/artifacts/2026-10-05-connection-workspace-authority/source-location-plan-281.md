# 281 来源章节可读性

## Recall

用户要求持续自主改进 UI（User Interface，用户界面）与功能，重点 Sources；最新只允许单 agent，覆盖旧 goal 的多 agent 措辞。不创建 Task/成员，不操作用户应用或旧页23/18107。280唯一来源生成器修复完成，真实 MDN 两章节导航通过，ea3971aa3302b3cbd0721f12d0651d7eebefcf26已提交，正常push正在原53459 hook中；本轮先调查落盘，等push完成和git干净后才编辑产品。

已读当前 SourceParts 整文件、CardParts 唯一共用引用/连续来源分组、messages.css、07-panel、168 path-first旧决策、280 Recall/实际Source/截图/Provider与后端checker。全仓sourceLabel/sourceDetail/SourceParts调用搜索：只有SourceParts当前私有label/detail/SourceChip；Main/Side/child经CardParts共用。overlay/test与script没有SourceParts渲染测试引用，不运行任何 UI 自动化。renderer-public-surface只检查声明的公共global赋值契约，可随build使用，不作为视觉验收。

真实before是280后态[03截图](source-fragment-280/live-02/03-sources-complete.jpg)：同文档真实不同fragment来源，标题/域名两行完全相同，用户要悬停或查看长工具URL才能分辨；不是来源identity或真实导航仍错误。此before已经Root实际呈现查看，复用该明确HEAD的真实证据，不另外合成Source或再跑before模型。

## 根因、影响与排除

触发点是SourceChip次行只显示URL.host，aria-label仅发布者标题。canonical SourcePart完整fragment已在280保留，sourceId及持久化/归组正确，但同文档章节location没有呈现。旧path-first168只改善无标题来源，发布者真实标题仍优先，因此同文档章节仍相同；Tooltip正确但不应成为基本辨识的必要操作。

仅修改这个共享视图的次行位置格式：fragment非空时原样显示`#fragment · host`，否则沿用host；aria-label使用同一位置值补充标题，屏幕阅读器可分辨。采用native URL parser读取实际hash，不decode猜标题、关键词映射或新增数据字段。发布者标题、完整Tooltip/URL/href/browser preview和所有file/document语义不变；新的位置格式是已有host格式的替换，不并行owner或影子事实。

长fragment/text fragment是真实导航数据，增加次行后无限wrap有撑高消息的风险。因此只有URL次行新增位置类，使用项目现有两行clamp（mailbox/card等）的CSS（Cascading Style Sheets，层叠样式表）primitive，完整值仍保留Tooltip与可访问性名称；不改变其他来源次行、字体token或普通excerpt。主要影响Main/Side/child的单条和展开多来源共用SourceChip；折叠多来源摘要仍以真实标题/数量为主，未改其契约。本轮不声称所有标题、多来源摘要或原全帧Rendering已解决。

纯UI呈现，不改后端接口/Source schema/ID/持久化/Tool/调度/队列/恢复/并发/终态，现阶段这些项无新异常。若真实验收出现异常按共享机制横审，不归因模型。旧历史带fragment的来源也自然呈现，旧已丢失fragment无法恢复。

## 实施与验收

先完成280原push actual join/HEAD upstream remote一致/干净，才改SourceParts与messages.css。typecheck和当前build，当前产物必须由dev服务实际呈现，不用静态检查冒充UI。禁止新增/运行UI自动化或负向测试；纯UI没有新增后端测试。

独立NativeService dev/ui18225，R `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/source-location-281-live-01`，E `source-location-281/live-01`。固定600000ms/12累计请求，目标提前4分钟关闭。复制授权auth+完整models，分别usable/projected/实际gpt-6.1-sol streaming预检后真实用户要求读取同一MDN #examples/#technical_summary及一个长text fragment资料，仅一次简短总结，不搜索/写文件/Task/委托。第三地址为同MDN实际文章中的一段原始英文文字的URI text fragment，URL是公开自然资料导航，不假provider/Source。

Root实际看两个章节次行可区分、长fragment两行边界及完整Tooltip；点击来源仍落在真实章节，记录完整截图和canonical/Provider并明示缺失场景。视口默认桌面，不额外移动端交付。只关闭自己的页面，唯一shutdown、原前台actual join，然后独立精确出生/物理输出请求/端口/pair退休；所有observer/checker实际结束后再保管五个自产物。

更新07-panel与根/本目录/月README、月记录，docs/architecture检查、公开凭据扫描和范围审查后单独提交。fetch/merge upstream、审查完整待推送集合后正常push。goal持续active，后续继续Sources与用户原子侧栏问题。
