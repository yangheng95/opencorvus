# 定时任务筛选结果的键盘导航

## Recall

用户要求本人持续分批体验和调查、先落盘根因与影响、实施、真实桌面和人工截图复核、运行聚焦正向检查、提交和合并上游后正常推送。第 479 批 `a800c4657` 已进入 `origin/main`，起始工作区原有 177 条状态留存。隔离实例的四项定时定义均用真实接口写入，三项暂停，一项下一次为 2099 年。验收仅浏览列表和详情，零运行、零模型调用和零凭据。

已读定时任务面板的 `scopedAutomations`、`filteredAutomations`、`deletionNeedsRetry`、`selectAutomation`、`rememberListFocus`、`focusListReturn`、项目选择器和原生 `SettingsRow`，共享 `SearchField`、现版 `ReleaseNotesPanel`、`ArchivePanel`、`MissionSkillPanel` 的结果导航及双语提示。核对定时服务的正式列表、创建、更新及历史，界面现有行与焦点样式和 [面板架构](../../current/architecture/07-panel.md)。全仓搜索 `automation-list-item`、`automations-search`、`listSearchInput`、`resultFocusTarget`、`createSearchResultNavigation`、`settings.search_keyboard_hint` 和当前定时相关检查。检索范围内无界面自动化测试。保持原 Tab 顺序，并按可见顺序移动实际焦点。[万维网联盟键盘界面指引](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus) · [焦点顺序说明](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)

## 基线、根因和影响

隔离开发页 `40960/ui/` 加载 `main-UY7zwaPc.js`。英文 100% 输入 `receiving` 后出现西门、北门和场院三项计划。按 Down 后原输入仍获焦，Up 后 Tab 先到清除按钮。中文 160% 点击已暂停后展示两条真实匹配，按 Up 后焦点仍在输入框。既有结果的打开按钮可读到北门的独立任务正文，详情返回键仍能回到筛选后的列表。 [真实基线截图](../../artifacts/2026-11-24-scheduled-automation-search-keyboard/README.md)

列表有当前状态、作用域和搜索词推导出的结果，行用原生按钮打开。当前搜索框只传输入值、清除和变更，未提供共享组件的 `resultFocusTarget`。结果行也未连接共用的相邻导航。开关筛选和删除均是 Tab 顺序中的独立控件，导致键盘使用者从搜索跳到计划时必须逐项经过它们。共用导航只在消费方告诉它当前的真实可操作行时生效，既有详情归焦和同面板的项目选择键盘钩子只处理自己的边界。

影响是有搜索词时到达和浏览已显示的计划按钮。真实计划身份、运行历史加载及列表筛选内容已确认正确。项目目标搜索是带选择状态的列表框，沿用该交互。详情按钮、建议模板、删除及其确认、原生 Tab 路径、接口和存储无须调整。基线的数据库结构检查通过，四个定义七个版本准确，未来计划及运行历史符合输入，执行和供应商活动为零。当前没有调度、队列、运行轮次或恢复异常的证据。

## 方案和验收

接入现有 `createSearchResultNavigation`，从当前列表依照实际顺序取得启用的原生计划按钮。输入处 Down 到第一项、Up 到最后一项，结果间按相同方向继续。导航和双语提示仅在有效查询且可打开项存在时提供。复用行禁用谓词处理加载、已有变更及删除待确认的禁用行。提示和无障碍描述由现有 `settings.search_keyboard_hint` 提供，可见提示随搜索控件一起出现，并沿用面板弱化文本样式。回车原生打开、现详情返回、清除和 Tab 使用既有路径。

在真实开发页对比英文 100% 和中文 160%。核对首末、相邻两向、回车打开准确正文和空历史、返回后继续导航、零结果时结果状态与参与筛选的状态/作用域、清除、原本的 Tab 路径及实际可见的焦点指示。视觉不足在同一计划列表内调整并重新截图。接着核对两个隔离服务的正式定义、历史和只读数据库，检查类型、双语、样式、构建、文档和架构，完成范围提交与上游推送。
