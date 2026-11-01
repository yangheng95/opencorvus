# 语言选项与命令发现：真实验收

单agent在正式开发服务`/ui`的自有后台页操作，未操作用户窗口。16张原图均实际呈现并逐张人工查看，无图像编辑或UI（User Interface，用户界面）自动化测试。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-before-chinese-query.jpg) | 基线英文Chinese查询的稳定空状态。 |
| [02](02-before-settings-language-names.jpg) | 基线设置中真实存在Chinese (Simplified)，与命令名称来源不同。 |
| [03](03-before-english-query-chinese-ui.jpg) | 基线中文“英语”查询稳定为空。 |
| [04](04-after-chinese-command.jpg) | 候选Chinese命中Chinese (Simplified) · 简体中文，真实ID zh-CN。 |
| [05](05-after-combined-language-query.jpg) | language Chinese命中同一可执行本地命令；背景工作检索仍在加载。 |
| [06](06-after-chinese-home-draft.jpg) | 实际切换中文，原LOCALE857_DRAFT_KEEP仍在主输入。 |
| [07](07-after-english-name-chinese-ui.jpg) | 中文“英语”命中英语（美国） · English (US)。 |
| [08](08-after-native-english-query.jpg)、[09](09-after-canonical-id-query.jpg) | English及英语 en-US命中同一个本地语言命令；截图时背景工作检索仍在加载。 |
| [10](10-after-restored-english-draft.jpg) | 实际恢复英文，草稿保留。 |
| [11](11-after-english-settings-options.jpg) | 英文设置下拉使用同一双语标签，English (US)不重复自称。 |
| [12](12-after-chinese-settings-options.jpg) | 通过设置切中文后，两原选项完整显示，英语保持本地化名与自称。 |
| [13](13-after-settings-restored-english.jpg) | 从中文设置选英语，实际恢复英文及同一规范值。 |
| [14](14-after-settings-return-draft.jpg) | 设置返回主页后原草稿仍在。 |
| [15](15-after-native-chinese-id-query.jpg) | 中文 zh-CN命中原中文语言动作，实际再次切换。 |
| [16](16-after-new-page-persisted-chinese.jpg) | 清空验收草稿后，新开同源后台页直接保持中文，验证原保存生命周期。 |

本地命令的可用结果与后台工作搜索独立，05/08/09不作为整个工作检索已经结束的证明；实际选中语言后的06/10/13及新页16验证切换和持久化。此验收不承诺未声明的跨语言同义词。

一个现i18n（Internationalization，国际化）目录登记原en-US/zh-CN、翻译键和语言自称，支持集合/类型及两处选项从它推导。删除设置和命令的旧内联列表，不加查询特例，不改原语言保存/默认语种规则。四项纯语言解析测试验证原运行语言政策、规范/区域输入及UnsupportedLocaleError；没有对UI文案或组件作自动化断言。

类型、2676键/两语言、普通构建/renderer公共面及当前文档检查通过。两轮schema（数据库结构）9/92表234499原行所有列保持，九个公开Goal完整事实一致；140附件、62项目快照内业务文件及Git（版本管理）身份保持。逐文件快照不含.opencorvus运行元数据，.git通过HEAD/ref/index/status核对，不扩大为全部元数据字节覆盖。

新增模型请求0/累计1180，四份auth/models配对副本退休，源认证元数据及模型目录字节/元数据保持。没有发送消息、创建Goal或修改项目文件。Titlebar原生语言切换、系统区域设置和新增语言未作本批实页重放。见[验证数据](verification.json)与[完整方案和记录](../../records/2026-11/2026-11-01-locale-choice-discovery.md)。
