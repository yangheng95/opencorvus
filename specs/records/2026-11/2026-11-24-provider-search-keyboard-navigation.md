# 模型服务商搜索结果的键盘导航

## Recall

用户要求本人持续分批体验和调查、先落盘根因及影响、实现并进行实际桌面操作和截图复核、运行聚焦正向检查、提交和合并上游后正常推送。第 482 批 `2124b8518` 已回读远端且本地同步，177 项无关工作区状态保留。隔离开发服务已有真实公开目录和由当前项目正式配置接口保存的自有 Fixture OpenAI Relay。其示例服务地址为本机回环地址，配置内无密钥、无登录、无连接测试或模型请求。

已读 `ProvidersPanel` 的目录和自定义列表导出、`providerMatchesSearch`、`hasProviderSearch`、作用域、可保留的目录读状态、`startEdit`、目录配置展开、模型及凭据动作、共享 `SearchField` 及 `createSearchResultNavigation`、两套翻译和按钮样式。全仓搜索 `provider-search-field`、`providerSearchInput`、`provider-catalog-configure`、`provider.action.configure`、`provider.form.edit_title`、`providerScope` 和搜索结果导航消费者。对照 [当前面板架构](../../current/architecture/07-panel.md)、[服务商架构](../../current/architecture/06-provider.md)、[目录读状态](2026-11-11-provider-catalog-read-status.md)、[服务商范围](2026-11-05-provider-scope-context.md)、[定时结果导航](2026-11-24-scheduled-automation-search-keyboard.md) 及 [万维网联盟键盘焦点实践](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus)。所查范围没有界面自动化测试。

## 基线、根因和范围

真实 `40990/ui/` 使用 `main-C9iWzgQx.js`。英文 100% 空配置搜索 `openai`，已有实际公开 OpenAI 卡片和配置按钮，Down 后输入仍获焦。加入自有配置后，正式目录和当前搜索给出自定义 Fixture OpenAI Relay 及目录 OpenAI 两条。Down 仍停在输入，用 Tab 先到清除，下一位是会发送试验请求的 Test 按钮。实际鼠标点 Edit 打开自有服务商的内联表单。简体中文 160% 同一搜索存在两条，Up 仍留在输入，目录行在滚动区下方。 [真实桌面基线](../../artifacts/2026-11-24-provider-search-keyboard-navigation/README.md)

现两类列表各自产生真实的编辑按钮与配置展开按钮，其他按钮承接模型测试、认证、密钥保存、删除等独立动作，行容器按原语只是布局与视觉分组。搜索框现只传过滤和清除，没有给共享控件可进入结果的 `resultFocusTarget`；实际结果按钮也未接入同行移焦。既有元数据匹配处理了发现内容和统计，界面仍按 Tab 的全部操作顺序进入已过滤结果。目录配置按钮的可访问名称也只描述操作，键盘直接归焦时缺少所属服务商身份。

影响限提供方搜索结果的进入、相邻浏览、操作名称和内联展开。正式目录、项目配置身份、搜索范围、排序、已保留数据、现有写入、安全确认、模型投影和连接路径均已核对；没有调度、队列、运行轮次或恢复异常。隔离配置与真实模型目录回读精确，认证文件不存在且数据库模型、消息和任务活动为零。

## 实施和验收

将当前结果及其原生按钮接入已有搜索结果导航，按页面顺序从自定义 Edit 到目录 Configure，选择边界和相邻行。无有效查询或可操作结果时使用原输入和原空结果。编辑和展开均使用真实已有的非写入动作，测试、认证、密钥保存与删除仍按原 Tab 顺序单独操作。复用现有双语方向键提示及编辑名称翻译，目录配置的可访问名称随真实名称和展开状态更新。普通 Tab、Enter 和表单的读写行为继续通过原动作，作用域及目录读状态仍可独立变化。

正式隔离候选在英文 100% 和中文 160% 核对混合结果中的首末、两向相邻、原生 Enter 与实际自有表单、公开目录的展开和收起、无结果和输入清除、既有 Tab 与不同提供方可访问名称。只打开并查看现有表单，不调用试验、登录或凭据操作。核对项目配置和公开目录的实际接口、隔离数据、聚焦正向测试、类型、双语、样式、构建、文档和架构，再提交并正常推送。

## 实施和最终验收

- 最终隔离候选 `40992/ui/` 使用 `main-CYVM-yGB.js`。英文 100% 的 `openai` 返回两条。Down 先聚焦 `Edit fixture-openai-relay`，再聚焦 `Configure OpenAI`，Up 回到编辑，回车打开实际项目表单及原回环端点。取消后从搜索 Tab 先到清除，再到原独立测试按钮，未发出测试请求。
- 中文 160% 用 Up 从搜索自动滚动到 OpenAI 配置，实际可访问名称为「配置 OpenAI」。回车展开后名称为「收起 OpenAI 的配置」，再次回车收起且继续聚焦该按钮。`open` 匹配一个自定义和三个目录条目，从搜索 Up 到 OpenRouter，再 Up 到相邻 OpenCorvus Zen，逐项准确。空结果有本地化状态，Down 保留输入，Escape 清除并恢复 89 条目录投影。本人复核 15 张原图。 [桌面证据](../../artifacts/2026-11-24-provider-search-keyboard-navigation/README.md)
- 实际项目配置与模型投影回读保留自有服务商与唯一模型原定义，公开 OpenAI 目录仍有实际模型。两套隔离配置均无认证文件，嵌入式数据库结构通过，任务、消息和模型活动为零。编辑器展开后把首字段带到高缩放视区属于相邻问题，旧版已复现并将在独立批次调查。
- 既有提供方定义与匹配的 9 个正向用例、15 条断言通过。类型、两种界面语言 3296 键、9378 个样式引用、真实构建及渲染公开面、353 项接口文档和 20 项架构索引均通过。真实桌面操作和截图作为界面证据。
