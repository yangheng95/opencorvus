# 归档搜索结果支持连续方向键浏览

## Recall

用户要求本人独立持续分批调查和迭代。先在真实界面复现、分析根因和影响并写规格，再实施、亲自操作桌面和复核截图、聚焦正向验证、范围提交、合并上游并正常推送。第 458 批 `bad3b9443` 与远端核对 0/0，原有 177 条状态保留。本批只用无凭据隔离服务。验收数据为通过正式接口创建和归档的四条空白对话或通用工作，不启动运行、恢复或删除，也不发送消息。

已读 [当前面板架构](../../current/architecture/07-panel.md)、[归档搜索键盘入口](2026-11-23-archive-search-keyboard-entry.md)、[归档打开焦点](2026-11-10-archive-open-reading-focus.md)、[归档搜索读取归属](2026-11-12-archive-search-request-coalescing.md)、`ArchivePanel` 的查询、可打开谓词、读取归属与分页、`SearchField` 的结果焦点接口和原生按钮，以及 `work-ledger/archive`、`coding.*.session.create`、项目内会话读、改名和归档。全仓核对 `canBrowseSearchResults`、`data-archive-action`、`resultFocusTarget`、`settings.search_keyboard_hint`、现有归档和版本历史消费者，涉及页面无自动化测试。

## 基线与根因

实际开发 `40798/ui/` 加载 `main-BDeP-LAp.js`，正式接口找到 `Evidence review Gamma`、`Evidence review Delta`、`Evidence review Alpha` 顺序的三条记录。英文 100% 下搜索框按 Down 进入 Gamma 的 Open，再按 Down 焦点仍留在 Gamma。同一状态按 Tab 先聚焦该行 Restore；没有触发操作。简体中文 160% 下从搜索框 Up 进入最后一项 Alpha，再按 Up 仍聚焦 Alpha。随后仅用 Enter 打开，显示准确 `Evidence review Alpha` 和已归档只读提示，焦点进入该提示。 [本人复核的实图](../../artifacts/2026-11-23-archive-search-result-navigation/README.md)

此前给 SearchField 的结果回调从当前已显示且可打开的结果挑首项或末项，成功把焦点交给真实 Open。实际 Open 行只绑定 Enter、Space 等原生激活行为；没有方向键处理。界面提示说方向键浏览，在输入阶段成立，进结果后不能沿实际只读项继续。已有分页、错误处理、查询归属和归档只读打开仍按正式契约。影响仅当前筛选中的键盘浏览，尤其在多项或较高缩放时需绕经恢复和删除控件。没有归档状态、项目隔离、存储、授权、任务调度、唤醒、恢复执行、并发或终态异常。

## 实施和验收方案

用同一个当前面板内启用的真实 Open 按钮集合，为输入端首尾交接和结果端相邻浏览提供目标。在查询还可浏览时，从 Open 上未被消费的上下方向键按当前呈现顺序移动到相邻 Open。到列表边缘继续保留该端焦点。现有父容器滚动将焦点目标带入可见区。恢复、删除、分页、默认 Tab、输入内清空、原生 Enter 和已打开归档的焦点依旧各自按当前处理。无查询、无结果、正等待读取或不可打开时维持当前按键范围。

候选在英文 100% 和简体中文 160% 中浏览同样的三个真实结果，包含输入到首项或末项、同一方向继续到居中项、反向和两端边界、穿越视区以及 Enter 打开真实 Work（通用工作）和 Chat（对话）只读历史。实测默认 Tab 仍进入当前行的恢复，键盘导航不会代替操作按钮。另复核无匹配与清除、相同正式归档列表、每条会话时间和空消息历史、原件字节和两个隔离数据库。运行聚焦归档及真实工作台契约、类型、语言、样式、真实构建与文档检查，再提交和正常推送。

## 实施和验证结果

英文 100% `Down` 从输入进入 Gamma，再逐条到 Delta、Alpha，末项按下键继续保留 Alpha 焦点。往回一项是 Delta 的 Open，Tab 落到同一行 Restore，Shift+Tab 回 Open，然后 Enter 打开准确的 `Evidence review Delta` 通用工作及只读归档提示。简体中文 160% 通过 Up 从输入进入 Alpha，继续向上到 Delta 和 Gamma，边界保留 Gamma。Enter 打开其准确归档对话并聚焦只读提示。查询项目 `field-notes-review` 的四项时，方向键滚动并聚焦先前在屏幕外的第四项 Alpha。确切零结果保持查询焦点，Escape 清除后重新呈现原四项。 [16 张交互后本人复核的真实桌面原图](../../artifacts/2026-11-23-archive-search-result-navigation/README.md)

两侧正式接口返回原始 4 项、筛选 3 项、无匹配 0 项，顺序与各自种子资料逐项一致。四条会话保留原身份、经验类型、项目、归档时间和空消息历史。每实例下载的五个原件与隔离 Git 提交和磁盘逐字节匹配。两份 SQLite（嵌入式数据库）通过 `quick_check`，各恰有四份归档会话，消息、任务、定时和模型活动为空。已验证所属的服务关闭返回 200、进程退出 0，40798 和 40800 释放。

Overlay `archive-state`、`work-ledger-list-request`、`work-ledger-selection-read` 合计 11 项、26 断言通过，核心 `bun run test test/work-ledger-search.test.ts` 7 项、46 断言通过。类型、语言、样式令牌、实际构建、渲染器公共接口、文档及架构检查通过。真实桌面覆盖筛选对话与通用工作及跨屏移动，未单独实页验证独立任务、Mission（多步任务）或在途续页。
