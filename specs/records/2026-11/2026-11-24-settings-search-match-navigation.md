# 设置搜索的匹配结果导航

## Recall

用户要求本人持续迭代，先调查与记录，再实施、真实桌面和人工截图复核、正向聚焦检查，范围提交并同步上游，之后继续下一批。上一批模型表 `a29dab72c` 已推送，原 177 项无关工作区状态一致。本批的隔离配置没有用户数据、模型调用或凭据。

已读 `ConfigDialogHost` 匹配集合、保留页、Tab 渲染，`config-dialog-control`、`CONFIG_SECTIONS`、共享 `SearchField` 结果导航、`Tabs` 和安装的 Kobalte 0.13.11 标签触发、列表键盘委托以及 [现行架构](../../current/architecture/07-panel.md)。全仓搜索 `focusSettingsSearchMatch`、`matchedConfigTabIDs`、`createSearchResultNavigation`、标签键盘、设置导航关键词和公开入口。当前路径未发现界面自动化。参考 [保留页规格](2026-11-22-settings-search-retained-page.md)、[搜索入口](2026-11-09-settings-search-keyboard-entry.md) 与 [万维网联盟标签页键盘实践](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/#keyboard-interaction)。

## 根因与影响

真实 `41070/ui/` 的 `main-DicpuUjp.js` 上，英文 100% 在 General 输入 `skills`，可见的匹配为 Chat、Work、Mission Skills、Skill Library。General 保留且标为 `Outside search results`。输入框按下键准确聚焦 Chat；Chat 再按上键，实际焦点和轮廓转到 General。移动到 Work 后按 Home 同样落到 General。简体中文 160% 搜索 `MCP`，在通用页可重现上键落到被保留的通用；当前页为关于时，从搜索框按上键到最后一个真实匹配「MCP 连接」，End 却将焦点移到标为不匹配的关于。 [实际截图](../../artifacts/2026-11-24-settings-search-match-navigation/README.md)

输入框的独立处理只从实际匹配集合计算进入点。进入真实标签后，片内触发事件冒泡给共用 Kobalte `TabList`。其委托使用所有已挂载标签，看到用于保留页面和原稿的非匹配活动标签，方向键及 Home、End 因此混用两种集合。保留页修复故意保留选中触发器和内容，正确处理了可见标记及输入框入口，未扩展到标签内部的导航。

影响范围是有匹配结果、焦点已进入真实匹配标签的上、下、Home、End。实际匹配词、侧栏顺序、本地化、现存选中标签和页面稿件、Tab 关联、显式激活以及无查询的原生导航继续沿当前合同。共享搜索结果功能的已有消费者沿当前有界列表行为。项目配置读写、接口、数据库、任务执行和恢复无变更需求。

## 实施与验收

由同一匹配集合驱动共享搜索结果导航的入口和后续路径。设置在标签触发器上使用共享结果浏览，并选择标签导航的首尾及循环语义。上、下只在真实匹配中循环，Home、End 到实际首尾。处理已拥有的事件时在触发器处阻止冒泡，避免 Kobalte 的完整标签委托再次移动。保留页继续挂载和可手动激活；无查询或非匹配焦点的原生标签机制继续可用。其他共享结果消费者继续使用当前方向键边界。

以实际英文 100% 搜 `skills`、简体中文 160% 搜 `MCP`，复核保留页在头尾、实际首尾与循环、跨分组、Enter 显式激活、清除查询和无筛选原生方向键。另查一个匹配与无匹配，核对焦点和页面关联，查看截图。运行设置元数据与现有筛选正向检查、类型、双语、样式、构建和当前文档检查。范围提交、上游合并与正常推送后继续下一批。
