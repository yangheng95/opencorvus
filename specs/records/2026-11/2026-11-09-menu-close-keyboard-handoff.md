# 菜单关闭后立即交还键盘输入

## Recall

用户要求本人独立持续按批迭代：真实体验，先落盘根因和影响，再实施，真实桌面交互和本人截图复核、聚焦正向检查、范围提交、普通合并上游、正常推送。上批 `cd865709c` 已推送，上游 0/0，起始 177 条原工作区状态一致。只用本批隔离开发服务与自建文件，取消所有文件写入确认，不读取凭据和模型目录、不发模型请求；不操作用户的窗口或服务。

已读[文件选区键盘发现](2026-11-09-file-selection-keyboard-discovery.md)、[批量复制和移动来源](2026-11-09-file-batch-transfer-source-review.md)、[此前的 Escape 归属](../2026-10/2026-10-29-menu-escape-ownership.md)及当前 [07-panel](../../current/architecture/07-panel.md)；全仓查 `oc-menu`、`oc-floating-exit`、`[data-closed]`、三类菜单宿主和 54 个 `Content` / `SubContent` 生产引用，以及现 Kobalte 0.13.11 的 `createPresence`、`MenuContentBase`、`MenuItemBase`、`createFocusScope` 源码和仓库实际补丁。已核对 [W3C 的菜单键盘模式](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)：Escape 关闭菜单并把焦点还给调用位置。触及路径未发现界面自动化测试。

## 实际根因和影响

隔离 39101 真实 `/ui` 加载 `main-DT29ifuu.js`。对 `alpha-row.txt`、`beta-row.txt` 多选，从 beta 按 Shift+F10 打开菜单（01）。紧接 Escape、Down、Shift+Space 后实际弹出 `Copy 2 source paths`，初始空格还进入了目标字段（02），而非向 gamma 扩展范围。三次输入的工具往返约 30 / 14 / 40 毫秒，不能当浏览器事件精确时钟。另一次仅在按 Escape 后立刻读取活动节点，`role=menu` 仍占焦点、`data-closed` 已为真，计算动画是 `oc-floating-exit`，时长 `0.08s`。分开操作时 Escape 后确实回到 beta，Down 与 Shift+Space 正常选中 beta 至 gamma（06），Enter 在文件面板打开原文 `isolated gamma row`（07）。新建下拉实际聚焦 `New file`（03），紧接 Escape、Space（约 22 / 27 毫秒）打开了 New file 确认（04）；两个误开对话框均取消，未写入文件。标题 View 使用同一 `oc-menu` 样式（05），从 View 项或 Language 项 Escape 时观察到先聚焦回 View；此入口没有复现两处误触发。公开根目录响应经实际 `/doc` 的结构校验，四个原件下载与种子和磁盘字节一致。基线页面已关闭，服务正常退出 0。

直接触发是 `popover.css` 将共享 `.oc-menu[data-closed]` 套用 80 毫秒退场动画。Kobalte 把关闭和内容是否仍挂载分开，实际关闭时释放限制，但等退场才移除有焦点的内容；其上下文菜单通过原焦点范围卸载回交，下拉通过原 `onCloseAutoFocus` 回交。菜单条目的 Down、Space/Enter 处理仍挂载，下一击因此可以进入旧菜单导航或选中条目。上次 Escape 修复解决的是按键被空集合提前取消、菜单根本未关闭；这里 `data-closed` 已生效，旧补丁及文件行键盘处理均不能消除关闭和回交之间的动画窗口。现有 Kobalte 卸载焦点回调可能仍跨一个事件循环，本次保留并以同一真实按键节奏回验；不承诺同一脚本栈里的人造并发按键。

影响的是实际使用 `.oc-menu` 且由 Kobalte 挂载的菜单：行/背景上下文、普通和嵌套下拉、标题栏；Composer 提及面板借用 `.oc-menu` 外观但不用此关闭属性。保留进入效果、原有菜单/子菜单层级、外部点击、原焦点交接、键盘和指针动作。Popover（浮出面板）、Select（选择器）及 Dialog（对话框）各自仍有原离场，不从本证据推断那些控制存在相同误激活。没有公共服务、文件写入、数据、配置、调用协议或执行轮次/队列/恢复变动，未见 Task/Mission/Session 调度异常。不新增独立关闭状态、事件拦截、手工 focus timer 或库补丁。

## 实施和验收

从现唯一共享关闭动效选择器移除 `.oc-menu`，保留其他浮层及进入动效，并同步当前架构说明。普通构建后用全新 39102 从实际 UI 重做同一快速文件菜单序列、同一新建下拉序列，确认前者接续选区与 Enter 打开原文，后者是重新打开新建菜单并能显式选择/取消；覆盖标题菜单、嵌套或外部关闭，以及至少一个中文场景。本人逐张查看桌面截图，必要时先补根因分析再改和重拍。两端公开根目录和原文件字节、真实服务写入日志与数据库核对，确保验证对象与项目正确；运行 CSS 设计变量、构建及渲染面、类型和文档检查，无非界面契约变化、不添加界面自动化或镜像测试。只提交本批，普通合并上游并审查完整待推集合后正常推送。

## 验收结果

真实 39102 `/ui` 载入 `main-B_4BkdLv.js` 和 `main-C3sIEDGz.css`。同一多选菜单（08）后以相近速度输入 Escape、Down、Shift+Space（往返约 35 / 12 / 18 毫秒），范围选中 beta 和 gamma，焦点在 gamma（09）。从新建文件项输入 Escape、Space（24 / 25 毫秒），实际重新打开了新建菜单，内容是新的菜单实例（10）；显式 Enter 才打开确认，Escape 回到新建按钮（11–12）。更多操作 → Parallel 子菜单仍把焦点交给滑块，Escape 关闭并回到更多操作，值保持 5（13–14）。标题 View 正常切换中文，Escape 回到视图（15）；中文文件菜单另一轮即时读取是原 beta 按钮、焦点已不在退场菜单。再次快速完成中文选区（16），紧接 Enter 打开真实 `gamma-row.txt` 原文并聚焦编辑器（17）。未验证所有 54 个菜单、所有平台或其它浮层的快速输入。

本人逐张复核 17 张实际截图。两端各有一次实际 `/file/content` 200（基线 `b4fa33c5-1f1b-4882-a596-815753547563`，改后 `62977285-f08f-4b23-9126-ff61cc9c4956`）、一次根目录公开结构校验、四次下载逐字节校验，物理及 Git 原件与种子一致；日志零文件写入，项目与会话、任务、自动执行及 Provider（模型服务商）数据库审计符合隔离预期。两台服务经正常请求关闭、原进程退出 0。普通构建及渲染面、类型、CSS 设计变量、文档和架构索引检查通过。无模型合同变更，未使用模型或凭据。[截图、回执与核对脚本](../../artifacts/2026-11-09-menu-close-keyboard-handoff/README.md)。
