# 持续迭代第二批：清除操作的焦点与保存语义

## Recall

用户持续目标不变：并行体验和调查、根因与影响先落盘、真实桌面页面截图人工复核、聚焦正向功能测试、必要且已授权的GPT-6.1 Sol验收、提交与上游同步推送，再自主下一批。上一批0d59082bb已完成21项/23断言、中英文页面、最终独立服务正常exit0、fresh fetch/merge及完整正常pre-push，push返回0，HEAD与origin/main一致。对应推送原始日志在`.tmp-codex-proxy-credentials-01a133/push-confirmed.log`；没有版本发布。

本批仍由两个只读单层分工分别审计共享SearchField与独立功能。已读AGENTS、05-config、07-panel及07-panel-reactivity搜索合同、2026-10-05-settings-search-authoring-lifetime、前批代理原值记录；全仓检索SearchField（19调用）、onClear/inputRef、NetworkProxyDraft/patchConfig/updateConfig/Config.mergePatch/updateProjectPatch及代理Save/Test/Delete。接口修改前已经审查全部调用；没有检索到本范围UI自动化测试。标准依据：[focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)、[disabled](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled)、[JSON Merge Patch RFC7396](https://www.rfc-editor.org/info/rfc7396/)。

工作区其他任务的file/index、text-file、相关测试与02-data、月索引/模型搜索交付记录，及归属未知的bun目录一律保留。本批scratch唯一前缀`.tmp-codex-proxy-credentials-01a133`，服务18571；不复用其他任务目录，不操作用户窗口/服务，不新增branch/worktree。

## 根因、现象与影响

### 搜索清除

真实中文设置页输入network→Tab到“清除”→Enter→直接键入“外观”：搜索仍空，焦点为页面。截图search-clear-before.png人工查看。SearchField.clear先onValueChange("")，其Show条件令当前清除按钮卸载；primitive没有input引用和focus。4个调用单独补focus，其他消费者没有，故同一控件行为不一致。已有设置搜索修复仅保留活动面板生命周期，不能修复按钮消失后的键盘焦点。清除按钮也遗漏disabled，而输入及提交按钮具有同一disabled。Root是div，样式不会禁用子button。

全量19调用：ComposerModelSelector/ComposerReferenceSelector/FileChangesView/MissionBoard各有仅focus的onClear；ConfigDialogHost/ConversationArtifactInspector/FileExplorerPanel/LogViewer/NetworkArtifact/TableArtifact/TreeArtifact/MissionSkillPanel/ReleaseNotesPanel/ProvidersPanel/ScheduledAutomationsPanel有重复setter；MissionCreateDialog为空回调；TerminalArtifact的onValueChange空值已清除装饰，onClear重复；MemoryPanel有唯一领域副作用（清除后加载原列表）；Mailbox没有onClear且当前合同明确没有X，保留其行为。6个外部inputRef仍负责打开、键盘和重置，不删除。

影响为共享搜索交互及全部消费者，无API/配置/数据库/任务调度合同修改。Memory清除回调可能同步setLoading(true)禁用input；因此focus必须在原回调后同步检查当前input仍连接且可用，不安排异步抢焦点。没有任何当前回调把焦点刻意转给不同控件或显式卸载字段。风险为误新增Mailbox清除、丢失Memory刷新或外部ref、重复调用setter、改变Terminal搜索装饰语义；完整调用迁移与真实页面样例复核处理，其他动态状态未实看部分保持未知。

### 代理认证清空保存

真实隔离项目手动保存虚构用户名/密码，再清空密码：保存前截图为空，点击保存后真实页面“已保存”且旧密码重新出现；canonical配置密码长度15而预期0。功能分工用生产Config.Info→Config.mergePatch→resolveNetworkProxy独立证实同一输入差异。保存直接把proxyDraft当merge patch，草稿省略空字段；RFC7396中省略保留旧值，null才移除。测试POST是独立完整草稿，省略正确；Delete整代理已有proxy:null正确。前批修复原值编码，未改变这个独立的删除语义。

唯一修改入口NetworkPanel.saveProxy：将空用户名/密码显式投影null；测试仍使用现有完整草稿。无需新helper、平行配置或改后端协议。字段原值、验证、请求归属与持久回填不变。项目删除覆盖可显露全局继承值，属于原配置分层，不能宣称本改动关闭继承认证；验收使用没有上层代理的项目自有值。无模型调用或真实凭据，不涉及调度/队列/执行轮次异常。

## 实施方案（源码修改前）

1. SearchField新增显式clearable?:boolean，唯一显示条件value&&clearable，默认false；18个现有可清除调用添加clearable，Mailbox不传。不保留onClear隐式许可的兼容路径。删除上述17个重复/空onClear，仅Memory保留真实副作用。局部保存input引用并转发原inputRef。clear依次发布空值、调用领域回调、对当前已连接且未disabled的input同步focus；清除button同样绑定disabled。
2. Network保存从现有draft创建merge patch，空username/password各显式null，地址为空仍整proxy:null。真正测试草稿继续省略空字段，不混淆两种协议。
3. UI仅真实页面交互/截图人工复核，禁止新增或运行UI自动化测试。本批不改非UI代码；继续运行现有21项正向代理功能测试作为相关配置/传输回归，不能冒充UI验收。Overlay类型、i18n、正式私有构建、docs与正常hooks。
4. 人工复核中文设置清除后继续输入、鼠标清除后继续输入、英文或中文更新日志/Provider搜索，以及原有带ref的模型选择搜索。确认活动设置页和未保存代理草稿仍保留。Memory特殊禁用和其余Artifact动态场景未覆盖时明确列出，不造数据或隐藏状态。
5. 实际代理保存先虚构原值，再清空密码保存、重开；再清空两字段保存、重开。真实canonical配置以明确返回对象/长度记录结果；不记录真实认证。两语言表单文案与遮蔽保持。没有外部请求，GPT-6.1 Sol不适用于本批。
6. 两根因分别核对差异与证据，可按独立slice提交；更新本spec、相关当前架构、双语未发布日志及索引。fresh fetch→merge upstream→完整待推送集合审核→正常push，保持持续目标active。

## 当前事实

两项真实基线均已复现，clear-before隔离服务经production stop自然exit0。已按方案实施：18可清除调用显式迁移，删除17个重复/空回调；保留Memory域动作与6个外部ref。同步读取props.disabled，避免Solid批处理时读取旧DOM.disabled。代理保存仅空字段映射null，测试草稿不变。两个分工独立复核通过，21项/23断言回归、Overlay类型、72秒私有构建、docs检查均通过。

实际后态完成中英文键盘/鼠标清除、设置草稿保留、版本搜索及模型选择器焦点；代理清空密码、清空两字段、重开和英文重存均成功，实际canonical配置与页面一致。详见[证据](../../artifacts/2026-10-13-clear-intent/README.md)。Memory加载/定时busy及其它Artifact动态视觉矩阵尚未逐项覆盖，不将代码审查称实页通过。clear-after服务原exec48586自然exit0，回执与物理退出/端口关闭完整。当前待范围提交、fresh上游同步与正常push；持续目标active。
