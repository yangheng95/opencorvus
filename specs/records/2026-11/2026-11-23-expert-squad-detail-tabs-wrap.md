# 窄桌面专家团详情标签的完整显示

## Recall

- 用户要求本人独立持续迭代，每批先真实体验并落盘根因和影响，再实施、真实桌面交互、本人截图复核、聚焦正向检查、提交、合并上游和正常推送。第 438 批 `dd21073d7` 已推送，独立版本日志提交随后进入上游。本批仅详情布局，无凭据、模型调用、专家团部署或发布。
- 已读 `AGENTS.md`、[现行界面架构](../../current/architecture/07-panel.md)、[已安装详情与焦点](2026-11-09-installed-expert-squad-detail-focus.md)、[详情读取重试](2026-11-10-installed-expert-squad-detail-retry.md)、[设置侧栏滚动](2026-11-23-settings-tablist-scroll-owner.md)、`ExpertSquadPanel` 详情标签及状态、共享 `Tabs` 的手动激活、设置详情服务 `/expert-squad/settings/detail`、本地化和 `settings.css`。全仓搜索 `expert-squad-detail-tablist`、`installedSquadSection`、`selectInstalledSquadSection`、真实详情选择与其他 Tabs 使用者。触及路径未发现界面自动化测试。
- W3C（万维网联盟）页签实践定义了手动激活及头尾导航。标签聚焦时应在界面中可辨认，并保留原排序和激活动作。 [页签模式](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) [键盘焦点可见性](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

## 根因和影响

1. 隔离 `40680/ui/` 实际加载 `main-GPe1ODtb.js`，项目从设置内真实打开内置 Research Studio。英文 100%、常规设置栏时四个标签完整并排。1280×720 英文 150% 与 666 像素侧栏下，详情 `TabList` 盒宽 434，标签横向需要 609。Package Details 从 x1258 开始，宽 160，视口只显示 22 像素。按 End 已聚焦该项，辅助技术能识别它，桌面文字仍在屏幕外。按 Enter 后实际显示包详情和原 README，证实内容存在且只在显式激活时打开。 [实拍](../../artifacts/2026-11-23-expert-squad-detail-tabs-wrap/README.md)
2. `.expert-squad-detail-tablist` 声明 `width:100%` 与 `flex-wrap:nowrap`，共享横排采用固定的单行高度和 `white-space:nowrap`。可缩小的设置内容下，整条溢出至外层正文水平范围，外层此时宽 506、滚动宽 645。Kobalte 的实际 TabList 横向滚动位置为 0，键盘不能依靠它显露末项。第 438 批只处理设置左侧纵向目录的明确滚动所有者；此处的常规动作更适合依可用宽度保留完整标签。中文 160%、710 像素设置栏时，四个更短标签在 378 像素空间中本来就能放下，正文左右宽度一致。
3. 当前该类只供已安装专家团详情。四个内置标签和已安装包的条件 Evolution 标签共用相同结构，原实际顺序、手动激活、选择与标题、返回精确行的合同维持。影响限标签布局、标签焦点可见性和详情内容的起始位置。包名称、内容、来源、版本、项目绑定、真实介绍、网络、设置协议、权限、配置、数据库、发布与 Task（任务）／Mission（多步任务）／Session（会话）的运行、队列、恢复和终态均不涉及。实际正式接口确认 `research-studio` 及内置来源、版本 `2026.11.07.1`。验收不变更默认选择、不安装或使用包运行。

## 实施和验收

- 设置详情标签列表改为可自然换行且高度随行数决定。沿用共用控件和现有间距令牌，允许不常见的长标签在单个控件内显示完整。窗口有空间时继续用一行，无横向附加入口或键盘事件，无更改共用 Tabs 和其他调用。
- 在真实桌面复核英文 150% 窄区、英文 100% 普通区及中文 160% 窄区。用现 Tab、End、Home、Enter 验证可见焦点和阅读顺序，打开真实包介绍并回到原安装条目，禁止把隐藏控件或视觉静态检查视作实际验收。核对正式详情、原默认选择及项目存储，运行聚焦设置读取、类型、双语、样式、构建、文档。人工检查原图，关停自有实例，提交、合并上游并普通推送。
