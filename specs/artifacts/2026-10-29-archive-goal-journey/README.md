# 归档、目标入口与搜索键盘体验

2026-10-29，单agent在自有开发实例38355/38356的真实`/ui/`完成桌面交互和原图人工复核。用户18571实例、原数据库与现用窗口未操作。对应[调查与方案](../../records/2026-10/2026-10-29-archive-goal-journey.md)。

## 可见结果

| 原图 | 实际动作与观察 |
| --- | --- |
| [01 首页](01-home-en.png)、[02 目标指南](02-goal-guide-en.png)、[03 返回目标表单](03-goal-draft-return.png) | 从＋打开持续目标，填写目标、查看指南、返回表单，原草稿和焦点保留；关闭取消，没有启动目标。 |
| [04 原历史](04-original-history.png)、[05 归档列表](05-archive-before-search.png) | 实际JSON附件会话通过标题栏归档，列表保留同一标题和项目身份。 |
| [06 无搜索结果](06-search-no-results.png)、[07 错误退出设置](07-escape-left-settings.png) | 修复前非空归档搜索按Esc直接退出设置，未先清空查询。 |
| [08 设置搜索](08-settings-search.png)、[09 错误退出首页](09-settings-search-escape-left-page.png) | 同一问题在设置导航搜索复现，定位共享SearchField与原生search默认动作顺序。 |
| [10 归档清空并留页](10-escape-clears-retains-archive.png)、[11 设置搜索清空](11-settings-search-cleared.png)、[12 更新日志搜索清空](12-release-search-cleared.png) | 修复后非空Esc清空当前查询并保持输入焦点；归档行、完整导航和74个版本分别恢复。空查询Esc按现有行为退出。 |
| [13 筛选下恢复成功](13-filtered-restore-success.png)、[14 恢复原历史](14-restored-history.png) | 使用真实Restore操作，保留筛选并显示成功反馈；返回原会话，原始JSON、Sources及真实模型回复一致。 |
| [15 模型搜索清空](15-model-search-cleared-retains-popup.png) | 非空查询Esc清空并保持模型弹窗与焦点；未更换模型。 |
| [16 引用弹窗关闭](16-reference-search-escape-closes.png) | 新对话草稿的Skills & squads搜索输入后一次Esc关闭，保留调用方显式关闭合同及按钮焦点；未发送。 |
| [17 中文归档](17-archive-search-cleared-zh.png)、[18 中文首页](18-empty-search-escape-home-zh.png) | 简体中文搜索按Esc清空留页，下一次返回首页，空状态、提示和焦点人工复核。 |

Esc关闭带有弹层退出过渡，立即DOM读取仍可能看到退出中的旧层；后续稳定页面和截图确认其关闭。这不是再次出现的渲染故障。DOM仅辅助定位，以上图片均实际呈现并人工查看；没有创建或运行UI自动化、组件/源码文案断言、截图或像素断言。

## 数据与运行证据

- [data-review.json](data-review.json)：原QA源库92表116028行逐行一致；基线归档副本116060行，恢复副本116092行，均schema9且integrity=ok。61个会话、387条消息、1161条part和0个Goal的原持久事实保持；只有所操作会话的归档/更新时间及对应总线、激活租约事实改变。
- 附件原命名空间35份原件均仍存在；基线副本在实例初始化时回收4个早先无持久引用的临时上传及4份metadata，未改变原件。六个真实file part保持。候选复制其回收后的27份文件，全部逐字节一致。不能把35份复制前计数误写成35份候选保留。
- [runtime.json](runtime.json)、[runtime-after.json](runtime-after.json)：两次正常公开shutdown均200，原exec与native/launcher均0，物理、输出、请求已结算，精确出生身份全部退休。认证与完整模型目录副本在退出后清退；原目录字节/元数据及认证元数据保持。两实例模型请求0，累计793不增，清理分别余3026979/2324285ms。仅验证本地投影，不冒称本轮实际Provider请求。
- [checks.json](checks.json)：普通Vite基线/候选构建以及类型检查实际终态；第一次类型检查失败已修复，首次候选构建未发布，最终构建及类型检查通过后才启动38356。未更新产品版本，运行页面早于本轮Unreleased文案追加，不宣称该追加行已实页验收。
- [search-consumers.json](search-consumers.json)：成熟TypeScript AST枚举20个生产调用，19个clearable，4个显式keydown。它是调查材料，不是UI测试或全部入口验收。

## 范围与限制

本轮修复仅共享搜索键盘所有权及其现有公开绑定handler类型，不修改API、数据库schema、迁移、模型调用或目标执行状态机。目标仅验证入口、指南、草稿往返和取消；真实运行/预算/暂停等已交付能力没有在本轮重新启动。Memory的onClear重新加载、FileChanges列表焦点、禁用输入、输入法组合态及其余消费者未逐一实页重验。模型弹窗空查询Esc后的稳定状态未在下一次点击前独立留证，故只认定其非空清查询验收；空查询返回应用在设置页已独立验证。不以静态枚举代替实际验收。当前修复验证通过，不代表整个产品矩阵已完成。
