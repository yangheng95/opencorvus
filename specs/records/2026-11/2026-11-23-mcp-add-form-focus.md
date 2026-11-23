# 项目 MCP 新增表单的键盘焦点

## Recall

- 用户要求本人独立持续迭代 OpenCorvus，每批先调查用户界面、功能与缺陷，完成根因和影响分析并落盘，再实施、在真实桌面交互、人工复核截图、运行聚焦正向测试、合并上游并正常推送。仅在需要且获授权时运行 GPT-6.1 Sol。起点为已推送的 `8012e1eb3`，保留 177 条用户工作区状态。本批是浏览器焦点与公开字段校验，不需要调用模型。
- 已读 `AGENTS.md`、[面板架构](../../current/architecture/07-panel.md)、[面板可响应性](../../current/architecture/07-panel-reactivity.md)、[新增草稿所有权](2026-11-12-mcp-add-draft-ownership.md)、[公开字段校验](2026-11-12-mcp-add-field-validation.md)和[前批窄桌面标题](2026-11-23-settings-section-header-readable-scope.md)。查找 `showAddMcp`、`closeAndClearMcpForm`、`handleAddMcp`、`mcpPanelActive`、`mcpRemoteUrlInput`、`mcpArgumentsInput`、`SharedResourceManagementPanel`、`focusAfterRender`、`aria-controls`、共享 `Button` 与对应的服务测试。当前触及路径未发现界面自动化测试。
- W3C（万维网联盟）的可访问富互联网应用实践指南说明了展开按钮的状态和受控内容，以及移除正在聚焦的元素时焦点可能回到 `body`。名称字段聚焦属于本产品表单的编辑起点。 [展开模式](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) [键盘焦点持续性](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## 根因与影响

1. 隔离真实开发服务 `40660/ui/` 加载 `main-DgVGW1AV.js`。1280×720、英文 100% 下按 Enter 展开「Add MCP」，表单已经显示，焦点仍在标题按钮，辅助技术没有展开状态。随后 Tab 先停在不可用的「Delete All」，再一次才进入名称。输入 `review-draft` 后按 Enter 激活表单内「Cancel」，焦点落到网页根部。重新展开恢复原草稿；从标题按钮自身再次折叠时焦点仍在按钮。[基线截图](../../artifacts/2026-11-23-mcp-add-form-focus/README.md)
2. `ConfigDialogHost` 承载设置页，连接页由 `SharedResourceManagementPanel` 的 `mcp` 分支呈现。标题动作只翻转 `showAddMcp`，Solid 的 `Show` 插入或移除同一个表单，缺少可访问展开状态和名称输入的聚焦目标。取消直接翻转同一信号，正在聚焦的取消按钮与表单一起移除。上一批只调整共享标题布局，未进入这个动作流。相邻 Skill 安装的关闭处理和定时任务表单已有各自的焦点处理；它们具有独立流程及不同的草稿合同，没有共用令同一焦点目标正确的控制器。
3. 同一项目的人工折叠保留输入及字段校验。成功清理与项目、连接代际或面板退休仍由原 `closeAndClearMcpForm` 按现有合同处理。作用域处理、语言和页内位置都需要在自动聚焦前保持当前。顶部按钮在连接动作等待时原生禁用；若表单已开，取消动作需要能把焦点交给它，激活本身仍受现有 `loading` 状态约束。批量删除按钮保持现有独立的可访问禁用与焦点合同。
4. 该表单只有一个入口，远程和本地共用名称字段及取消动作。检查正式 `/project/current` 和 `/mcp/project`，两个隔离项目各自返回准确工作区与空配置映射。配置持久化、网络传输、凭据、请求与回执、SDK（软件开发工具包）、运行调度、队列、Task（任务）、Mission（多步任务）与 Session（会话）执行、数据库、迁移和发布无需改动。批内证据未发现这些共享机制异常。成功回执中的焦点不是本批人工操作合同，保留既有处理。

## 实施与验收

- 使用现 `Button` 和同一 `showAddMcp`，标题按钮暴露 `aria-expanded`，展开时 `aria-controls` 指向已挂载且具有唯一标识的表单。显式展开在挂载后将焦点交给当前所有者的名称字段。面板、选择范围、连接或用户焦点已变化时，此次聚焦作废。
- 人工折叠或取消在卸载表单前将焦点交还当前标题按钮，交由浏览器显示焦点目标。等待时标题按钮保留焦点并表示可访问禁用与忙碌，由原等待状态守住同一激活入口。保持原草稿、校验和清理规则。
- 在本地开发服务器的真实桌面页面上复核英文正常宽度和简体中文窄栏高缩放。用键盘展开、直接输入、切换类型、取消和重新展开，再以鼠标确认标题折叠。复核无效地址的可读原字段反馈和焦点，使用独立已提交的两个项目确认草稿退休。截图由本人目视复核。使用正式公开接口检查项目空配置，运行聚焦非界面连接服务合同、公开新增契约、界面类型、国际化、样式、构建、文档和架构索引检查。隔离服务正常关停。
