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

## 候选视觉修正

首次候选实际资产 `main-ClfcSvQ2.js` 已从搜索用 Down 进入场院，继续两次 Down 到西门和北门，原生回车打开北门任务的独立正文和空历史。详情返回后目前的正式重读使列表先显示输入焦点，再按 Up 可到最后一项，Tab 到这项真实删除按钮。原样保留该重读边界，后续可独立调查怎样按真实计划身份恢复详情的原行。

已聚焦结果的背景和轮廓上下边可见，左右边被截掉。实际几何中行与父容器的左右边界同为 404、1164 像素。父容器是 `.s-surface.automations-layout`，其共享样式 `overflow: hidden`，行通用键盘轮廓为实线并向外偏移约 0.67 像素。增加该计划打开按钮的焦点轮廓内偏移，复用系统已有边框宽度与颜色，继续使用同一可用行和相同裁剪边界。最终以实际完整焦点环及中英文导航重验。[首次候选原图](../../artifacts/2026-11-24-scheduled-automation-search-keyboard/intermediate-en-clipped-focus-outline.jpg)

## 最终验收

- 隔离 `40964/ui/` 的 `main-Cx1AsT5o.js` 在英文 100% 显示西门、北门、场院三个匹配。Down 从输入到首项即见四边完整焦点环，再 Down 后回车打开北门，正文 `Check the north dock receiving manifest.`、已暂停详情和「尚未运行」历史准确。返回列表的原重读聚焦搜索，Up 到场院末项，Tab 到该项原生删除按钮。
- 中文 160% 实际交叉筛选已暂停和全局，Up 到第二条北门，Up 到第一条西门，再 Down 返回北门，回车打开同一暂停详情。中文提示和四边完整的焦点环仍清晰。切到项目范围的空结果时焦点停留搜索，真实「清除筛选」恢复状态、范围和全部四项，并聚焦空输入。人工复核全部 13 张桌面图。 [实际截图](../../artifacts/2026-11-24-scheduled-automation-search-keyboard/README.md)
- 三个真实隔离服务通过正式列表和历史回读，以及只读 SQLite（嵌入式数据库）结构和数据核对。各有四项定义、七条保存修订、一次精确未来时间及空运行历史，轮次和模型请求均为零。没有使用真实模型凭据。
- 聚焦计划日历和保存回执的 6 个正向用例及 29 项断言通过。应用类型、两种界面语言 3294 键、9375 个样式变量引用、真实构建及渲染公开面、353 项应用接口的文档检查和 20 份架构文档检查通过。界面证据来自实际桌面交互和截图。
