# 启动链接与失效目录发现：真实证据

对应[调查与方案](../../records/2026-10/2026-10-22-startup-location-discovery.md)。只用一个开发agent；两个独立Source CLI（Command Line Interface，命令行接口）开发服务，内置浏览器真实交互与人工截图复核，零模型调用。修复前代码921fcea57a8d1bcda350b704580c80fd4779cb3c，before真实main-Bv-r8j-J，after正式Node构建main-B1unUUgO；运行中静态资源未替换。

## 直接证据

| 对象 | 真实观察 |
| --- | --- |
| [请求日志摘录](startup-request-observation.json) | before目录扫描ENOENT、GET discovery500、同requestID的initApp失败；after显式Task先走原索引/选择器，手动同缺目录discovery200，32次健康读取。原完整日志留私有，摘录没有模型prompt或凭据。 |
| [实际发现响应](after-live-discovery.json) | 缺失启动根保留，defaultDirectory为空，163个注册项目身份正常返回。 |
| [后端修复前测试](test-before.log)、[修复后](test-after.log) | 原有效目录1通过、缺失/文件根2失败；修复后三项真实HTTP（Hypertext Transfer Protocol，超文本传输协议）路由/临时文件系统/隔离数据库的完整输出合同通过。不含UI测试。 |
| [完整数据核对](data-preservation-observation.json) | 两scope各90表152721原行/字段/rowid或主键/时间保持，源bytes/mtime、schema3、实际应用对象/integrity、完整五键canonical保持，Provider activity382→382。 |
| [before结算](before-physical-terminal.json)、[after结算](after-physical-terminal.json) | 原96638/74553均exit0、公开shutdown200，原生physical/output/request/launcher/精确出生链完全结算；模型0/0，无auth/models副本，自有IAB94/95已关闭。 |
| [构建](build-after.log)、[Overlay类型](typecheck-overlay-current.log)、[后端类型](typecheck-backend.log) | 正式Node构建1分16秒exit0，两个类型检查exit0。构建含既有第三方use client/大chunk警告，不把静态通过当视觉验收。 |
| [API文档](docs.log)、[当前架构](architecture.log) | 345操作/26组、20份当前架构通过。接口shape、SDK、schema/迁移和版本未改。 |

## 人工查看的精选画面

共实际捕获查看17张，归档13张关键证据；其余重复/悬浮遮挡/中间阅读位置保留私有。每张均真实页面，不做快照、像素或DOM（Document Object Model，文档对象模型）断言。

| 画面 | 人工结论 |
| --- | --- |
| [01 修复前链接](01-before-task-link-home.png) | 有效原Task链接停首页。 |
| [02 修复前手动选择](02-before-manual-task.png) | 同一Task可手动打开，原正文/成员存在，排除资源不存在。 |
| [03 修复后链接](03-after-task-link.png) | 同一失效默认目录条件下自动进入原Task。 |
| [05 来源A](05-after-source-a-visible.png) | 原DP6d成员、arXiv身份/标题/域名卡片和正文可读。 |
| [06 来源B](06-after-source-b-visible.png) | 切换ByPb后对应真实ACL来源与正文。 |
| [07 侧栏重开](07-after-dock-reopened.png) | 保留ByPb及其来源；这是历史读取，不能冒充活跃流闪烁验证。 |
| [10 中文首页](10-after-home-zh.png) | 输入框下方持续目标入口、说明和快捷建议层次清楚。 |
| [11 中文指南](11-after-goal-guide-zh.png) | 模型配置、创建、标准/预算、进度/暂停三步指引真实可见。英文指南也已人工查看。 |
| [12 创建表单](12-after-goal-draft-form-zh.png) | 首页原草稿带入目标，预算可选，确认才启用新会话自动续跑。未提交创建。 |
| [13 取消](13-after-goal-cancel-draft-zh.png) | 关闭表单后原草稿留在同一首页。 |
| [14 失效资源](14-after-missing-task-details-zh.png) | 本地化反馈及原WorkspaceLocationError详情可读；随后正常导航成功。 |
| [16 Chat刷新](16-after-chat-link-refresh.png) | 原Session、真实OK回复和Code/Chat保持；模型配置提示符合零模型副本范围。 |
| [17 全局launcher刷新](17-after-launcher-refresh-zh.png) | 全局首页/Work产品意图和原草稿保留，Goal仍可见。 |

## 复核边界

归档构建日志只清理行尾空格，原始输出完整保留于私有调查目录；请求文件为明确字段摘录，原日志也留私有。

[资格与限制](qualification.json)保留原handle、端口、静态包和数据身份。源码CLI/ui运行器、全量serialize/逐行核对、原生关闭与日志摘录脚本归档用于调查复现；原数据库、全库dump、完整私有日志、运行时二进制和前端bundle不提交。未来重现before须检出记录中的原生产提交及对应正式包，不能把当前已修复源码作为before。

没有对用户18571页面/进程/数据库操作，无Provider凭据使用、真实新Goal或Task提交，无schema升级/清库。Work独立会话、Mission正常页、启动离线再重连、实时流/连续帧闪烁未在本轮取得资格；不以静态通过或历史页面替代。
