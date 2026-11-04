# 模型设置语言与空模型引导：实际体验证据

[调查与方案](../../records/2026-11/2026-11-05-provider-settings-language.md) · [资格原始摘要](qualification.json)

2026-11-05，由一个agent在两个隔离原生开发服务的`/ui`页面手动操作并逐张视觉复核。用户正在使用的18571页面、窗口、进程和真实用户数据库未操作。

## 可复核的变化

中文统一为“模型服务商”“接口地址”“API（Application Programming Interface，应用程序接口）密钥”“服务商标识”。当前空列表改为说明没有可选模型，设置名称取现有同一导航翻译，真实点击可到同名设置页；品牌、模型标识、环境变量和原诊断保持真实内容。

本次空模型场景保留全局有效OpenAI登录和12模型目录，只在本人新项目设置空模型允许列表。项目运行目录connected为空并不证明全局未登录。真实空白会话通过公开接口创建并命名，没有伪造消息/工具结果；四检查点均0消息。原项目真实Sol选择和目录仍可见。

| 实际截图 | 观察范围 |
| --- | --- |
| [01-before-empty-model-english.png](01-before-empty-model-english.png) | 修改前：英文空模型提示错误归因为未连接。 |
| [02-before-chinese-provider-list.png](02-before-chinese-provider-list.png) | 修改前：中文模型服务商列表混用Provider。 |
| [03-before-chinese-search-empty.png](03-before-chinese-search-empty.png) | 修改前：中文无结果提示混用Provider。 |
| [04-before-chinese-add-form.png](04-before-chinese-add-form.png) | 修改前：添加表单混用Provider、API URL和API Key。 |
| [05-before-advanced-invalid-address.png](05-before-advanced-invalid-address.png) | 修改前：高级表单和无效接口地址。 |
| [06-before-empty-model-chinese.png](06-before-empty-model-chinese.png) | 修改前：中文空模型提示仍要求到英文Providers认证。 |
| [07-after-empty-model-english.png](07-after-empty-model-english.png) | 修改后：英文说明当前没有可选模型。 |
| [08-after-english-provider-settings.png](08-after-english-provider-settings.png) | 修改后：英文入口实际到达模型服务商设置。 |
| [09-after-english-form-validation.png](09-after-english-form-validation.png) | 修改后：英文表单/高级设置与无效地址校验。 |
| [10-after-chinese-provider-settings.png](10-after-chinese-provider-settings.png) | 修改后：中文服务商标题、计数、搜索和配置。 |
| [11-after-chinese-search-empty.png](11-after-chinese-search-empty.png) | 修改后：中文搜索无结果说明。 |
| [12-after-chinese-add-form.png](12-after-chinese-add-form.png) | 修改后：中文添加表单。 |
| [13-after-chinese-advanced-validation.png](13-after-chinese-advanced-validation.png) | 修改后：中文高级表单及有效地址要求。 |
| [14-after-empty-model-chinese.png](14-after-empty-model-chinese.png) | 修改后：中文空模型提示及明确设置入口。 |
| [15-after-empty-model-settings-navigation.png](15-after-empty-model-settings-navigation.png) | 修改后：实际点击空模型入口到达同名设置页。 |
| [16-after-original-project-sol-models.png](16-after-original-project-sol-models.png) | 修改后：原Task真实OpenAI目录12模型，原GPT-6.1 Sol选择保持。 |

## 运行与数据

- 两阶段各初末9项公开接口检查，共36项通过；原持续任务、交互、目标、24条收件箱、既有文件/404、原四题八文件、两轮四题与40行纪要、不可变快照/四资源均保全。
- 两原生句柄正常退出0，公开关闭200，物理/输出/请求结清；四份认证与完整模型目录副本成对退休，原目录字节/元信息和认证元信息保持。0模型请求，累计仍1400。
- 数据结构schema10、92表不变；原293652行全部保全。本人新项目/空白会话及其索引、发布和租约增加84行；新版只新增正常服务租约/授权2行，最终293738行。3个新增发布都属于同一本人项目/会话，类型为创建及两次更新。114项目/104隐藏配置和277附件完整保全。没有修改或迁移真实用户数据库。
- 8包类型检查、1次最终Node前端构建、接口/文档/架构检查通过。纯显示改动未新增或运行UI自动化测试，也未运行无关单元测试。

## 范围与限制

英文覆盖空模型/设置跳转/列表/表单校验，中文覆盖列表/搜索无结果/添加/高级/地址校验/取消/空模型/设置跳转，原项目模型目录实际展开。认证、密钥保存、删除、模型发现/刷新和连接测试未执行，其相关文案仅源码复核。账号200和模型目录预检不代表真实推理验收。既有构建大包警告仍在。

准备阶段错误假设已由真实目录和400/ProviderModelNotFoundError纠正；临时恢复本人空闲项目模型后合法创建会话，再恢复空允许列表，两次只释放该本人项目实例。复制上轮输出的私有检查器冲突已核对原件/修复准备链并以新输出名完成原检查；失败原始回执保留，未修改业务断言。
