# 模型服务商新增与编辑的焦点交接

## Recall

用户要求本人持续独立分批迭代，先落盘根因和影响，再实施、实际桌面交互和截图复核、聚焦正向测试、范围提交与普通推送。上批搜索键盘导航 `9d94cffc6` 已同步 `origin/main`，原有 177 项工作区状态保留。本批隔离项目通过正式接口持有一个自有 Fixture OpenAI Relay、一项实际模型声明及无凭据的公开目录。实际原地址和拟验收的保存地址都是本机回环地址。

已读 `ProvidersPanel` 的 `startAdd`、`startEdit`、`resetForm`、`cancel`、`handleSave`、`formOccurrence`、Scope（作用域）变更和清理、数据写回执及首个接口地址字段。核对共享 `TextField`、`SettingsPanel`、提供方列表身份键及同项目检索，并检索全仓 `provider-add-card`、`formOccurrence`、`handleSave`、`provider.form.edit_title`、`provider-search-keyboard-hint`、`updateActiveProviderConfig` 和同类 Settings 表单焦点。依据 [面板架构](../../current/architecture/07-panel.md)、[服务商架构](../../current/architecture/06-provider.md)、[上批搜索导航](2026-11-24-provider-search-keyboard-navigation.md)、[目录行身份](2026-11-11-provider-row-identity.md)、[保存回读](2026-11-12-provider-save-catalog-feedback.md) 和 [万维网联盟焦点实践](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus)。所查范围无界面自动化测试。

## 基线、根因和影响

实际 `41000/ui/` 使用 `main-CYVM-yGB.js`。英文 100% 从工具栏鼠标点 Add，内联表单已显示但焦点仍在工具栏 Add；点取消后，焦点落到页面根。简体中文 160% 搜索 `fixture-openai-relay` 后用 Down 和回车打开编辑，表单已挂载且真实地址保持原值，位置在视区下方，焦点仍在自有服务商的编辑按钮。下一次 Tab 在原列表聚焦未激活的删除控件。点取消后焦点同样回到页面根。 [真实基线](../../artifacts/2026-11-24-provider-form-focus-handoff/README.md)

新增与编辑在重置和填充现草稿后，只切换 `showAdd`。内联编辑器与列表是同一滚动区域的兄弟内容，原触发器一直挂载，浏览器保留原焦点及旧 Tab 顺序。取消及接受后关闭只是卸载表单，当前其中的焦点控制被移除且没有现有交接，所以失去焦点。上一批让键盘能够选择真实 Edit，但动作后的焦点仍由原表单生命周期决定。既有 `formOccurrence` 和项目连接范围负责草稿及读取/写入归属，未出现持久配置、模型目录、凭据或调度执行异常。

影响为当前自有提供方新增和编辑、真实操作完成或操作者取消后的焦点。目录配置的展开按钮、表单字段值、已有请求/错误、测试、密钥、登录和删除均沿其当前路径。项目或连接切换通过原作用域效果结束旧表单；恢复焦点时应继续检查实际作用域一致，容器卸载也不能转移焦点到旧页。当前已在正式 API（应用程序接口）和只读 SQLite（嵌入式数据库）核对自有定义、真实模型以及零执行。

## 实施和验收

将显式 Add 或 Edit 的实际按钮存放在本次表单实例，复用当前 `formOccurrence` 与作用域，在内联表单呈现后把焦点交给首个接口地址输入，让浏览器把它滚动到视区。用户取消或成功接受后关闭时，沿同一个关闭流程，在活跃焦点仍归该表单、作用域及发生轮次有效的情况下回到实际原按钮。若同作用域内原按钮被搜索移出，交给现有搜索输入。项目、连接或页面变化延续现有取消和归属，已移动到其他控件的焦点保留。保存失败继续表单和原有错误，不改请求或持久数据合同。

用真实英文 100% 和简体中文 160% 验收键盘与鼠标打开、首字段可见和获焦、原始地址与模型读取、取消返回添加或编辑按钮。再在实际搜索移出该行时取消，核对回到搜索。对隔离自有配置做一次不含凭据的正式保存，核对原定义身份、实际新回环地址、保留模型和保存后可继续的焦点。复核实际截图和配置/模型公开接口、零认证和零执行数据，聚焦提供方正向测试、类型、双语、样式、构建、文档和架构，然后提交并推送。
