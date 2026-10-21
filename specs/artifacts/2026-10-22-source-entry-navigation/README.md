# Sources 导航与权限历史呈现

[调查与结果](../../records/2026-10/2026-10-22-source-entry-navigation.md)。本轮单开发 agent，真实 Source CLI（Command Line Interface，命令行接口）/ui，模型预算及实际请求0，没有凭据或模型目录副本。

实际 Sources 标题/域名、复制、网页新标签目标和成员关闭重开可读；未找到新的 Source 展示缺陷。发现历史权限响应复用了命令式动作语言，修正唯一 durable-decision helper 为已批准/已拒绝及精确范围过去式。正在审批的动作按钮、原消息和持久决定不变。

| 图片 | 人工观察 |
| --- | --- |
| [01](01-member-open.png) | 原成员B打开后处于长正文尾部 |
| [02](02-member-source.png) | 真实 Source 标题与ACL域名 |
| [03](03-source-copy.png) | 英文原复制入口返回 Copied |
| [04](04-opened-source-target.png) | 实际打开的新页为原 ACL 论文地址；查看后关闭 |
| [05](05-before-permission-history.png) | Task已完成，原历史响应仍显示命令式 Allow Once |
| [06](06-after-permission-history-en.png) | 同一历史决定改为 Approved once |
| [07](07-after-permission-history-zh.png) | 中文明确显示已批准本次 |
| [08](08-after-member-source-zh.png) | 新版中文 Source 和主区已批准状态同时可见 |
| [09](09-after-member-reopen.png) | 关闭重开成员侧栏保留原 Source 阅读段 |
| [10](10-after-source-copy-zh.png) | 中文来源复制返回已复制 |

十张图片全部实际查看，不是 UI 自动化测试或像素断言。05为实际外部新页后缩窄的默认 IAB 区域；本轮没有设置 viewport override，不作同尺寸几何比较。复制反馈来自原真实控件，未读取先前剪贴板。

[只读权限事实](permission-facts-detailed.json)证明原四请求有唯一 allowed_once 决定槽及执行成功，Task有完成事件。尾部 stale 的决定槽为空，是原 continuation 正常退休，不撤销授权；不能凭最后一个事件名把它误报为执行异常。[观察](observations.json)、[完整数据保留](data-preservation-observation.json)、[before结算](before-physical-terminal.json)、[after结算](after-physical-terminal.json)及[构建原输出](build-after.log)记录实际证据。两scope90表156566原行/schema3/完整canonical和来源bytesmtime保持；模型0，原句柄48411/82784完整物理结算，IAB102/103/104关闭。

归档诊断脚本依赖仓库 .tmp-product-iteration/live-sol-task-guidance-413.ts、原生supervisor和记录中的自有路径，不能当独立安装包。数据库、私有原行快照、完整运行日志和凭据不归档。[实际秘密值扫描](credential-scan.json)只在本地内存读原值并记录命中计数。

当前实页决定均为 allow_once；其他批准范围/拒绝仅纯呈现映射审查，未宣称这些分支有新实页资格。新模型执行、所有来源类型/摘录、连续帧Rendering、认证事件流不在本轮资格内。用户18571页面/进程和真实数据库未操作，无版本或schema变化。
