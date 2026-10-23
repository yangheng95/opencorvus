# 首页、目标指南与真实归属

[方案、根因和保留边界](../../records/2026-10/2026-10-24-home-launcher-scope.md)，[原始运行事实](evidence.json)。561仅使用一个开发agent，在真实source CLI（命令行入口）`/ui/` 与内置浏览器手动操作，所有下列截图实际呈现并人工查看，没有用户界面自动化测试。

修复：目标帮助仍硬写“创建目标”，当前所有新建表单的确认按钮已统一为“开始执行目标”/Start goal。组件内一个本地化文案键同时供帮助插值和footer使用，删除两locale废弃的Create goal标签；保留用户要求的唯一加号入口和原表单。数据、公开接口、权限、执行和迁移不变。

## 截图资格

| 图片 | 观察与资格 |
| --- | --- |
| [01](01-global-home-en.png)、[02](02-goal-menu-en.png)、[03](03-goal-form-en.png)、[04](04-goal-help-en-before.png) | 原正式构建：全局首页标题正确，+入口正常预填，首页按钮Start goal与帮助Create goal不一致。 |
| [05](05-real-home-reply.png) | 实际全局发送并收到真实Sol回复。Project/Session归属由API和数据库独立核对，不由模型自述证明。 |
| [06](06-global-home-zh-before.png)、[07](07-goal-help-zh-before.png) | 中文首页布局与原帮助错误指令。 |
| [08](08-home-form-zh-fixed.png)、[09](09-home-help-zh-fixed.png)、[10](10-existing-form-zh-fixed.png)、[11](11-intermediate-existing-help-mismatch.png) | 中间main-p5w1SQyE构建，仅首页正确；已有会话实际按钮同样是开始执行目标，11帮助仍错。保留未通过证据，不算最终资格。 |
| [12](12-verified-home-form-zh.png)、[13](13-verified-home-help-zh.png)、[14](14-verified-existing-form-zh.png)、[15](15-verified-existing-help-zh.png) | 最终main-DXPgQK57：中文首页与已有会话按钮/帮助一致，取消后原草稿保持并清理。 |
| [16](16-verified-home-form-en.png)、[17](17-verified-home-help-en.png)、[18](18-verified-existing-form-en.png)、[19](19-verified-existing-help-en.png) | 最终英文首页/已有会话实际呈现，按钮与指南同为Start goal。 |
| [20](20-side-attention-details.png) | 零请求预算拦住memory helper的实际失败详情，E2E_REQUEST_BUDGET_EXHAUSTED。保留失败，不作侧聊通过。 |
| [21](21-side-form-verified.png)、[22](22-side-help-verified.png)、[23](23-side-ready-verified.png) | 修正私有验收预算后的独立服务，原New side chat创建Side chat 2；独立Goal归属、按钮/帮助和正常就绪实图通过。未发送侧聊输入、未提交Goal。 |

全局发送实际POST `/global/work` 返回Session ses_-zUR5OmbOzzRR2yKQtE2、Project prj_hNGT4wsmwC7GHqHckukD及before runtime下dated UUID目录205cb8。两个相同当前行的初步线索已排除：另一个是y1070的视口外Recents投影，项目行在y221，旧Project只是相似短标题。API、数据库、真实DOM祖先和矩形事实在evidence内；没有为这次误判修改WorkLedger或reconcile。

## 运行与数据

| scope | 原exec | 实际模型请求 | 关闭预算 | 结果 |
| --- | ---: | ---: | ---: | --- |
| before | 16649 | 4 | 644959ms | 原UI、有限真实全局发送 |
| after | 76206 | 0 | 1008133ms | 中间已有owner指南未通过 |
| verified | 21586 | 0 | 884437ms | 最终Home/Chat通过；Side触发max0预算边界 |
| side-verified | 47383 | 2 | 1013009ms | 真实memory处理、Side指南和就绪通过 |

四者均独立20分钟原生边界、180秒启动无活动、五分钟收尾，公开shutdown200，原exec/native/launcher退出0及physical/output/request完成。完整OpenAI条目与完整相邻模型目录按用户热认证授权配对复制、验证未过期OAuth和gpt-6.1-sol投影；before真实预检证实可用与实际请求模型。六次实际模型请求全部gpt-6.1-sol、流式200、原Provider reader EOF（End Of File，读完）；总上限8，没有非流式或开发子agent调用。四份auth/catalog各退休1，原catalog9155406字节/修改时间/完整内容保持。

原请求见[before](before-requests.jsonl)、[after](after-requests.jsonl)、[verified](verified-requests.jsonl)、[side-verified](side-verified-requests.jsonl)，仅规范身份/路径/时刻及abort，不含凭据、票据或正文。side-verified第一次私有launcher路径拼接失败exit1，尚未创建原生服务；修正实际bundle后重跑原入口，未以观察超时为由重启。

源90表原172483/173476/173478/173854行、字节/修改时间/完整canonical配置、实际schema4对象及integrity保持。目标before仅两条容量租约字段变化；after旧行保持；verified与side-verified有本测试Project的记忆文档和租约正常变化，side-verified另消费一条待整理user_message及其chunk。[待办生命周期观察](memory-lifecycle-observation.json)与[仍存在的canonical Message及复制证据](inherited-memory-observation.json)区分原消息和待处理副本；不宣称所有target行零变化。原Task/Mission/Session/Goal字段保持。工作区并行迁移4不属于本提交，用户数据库未参与。

最终正式Node build及2locale2535键/参数检查通过，文档检查346 operations/26 groups；类型与正常推送hooks按交付执行。这些是补充，视觉资格来自上述真实页面。

## 后续根因与限制

真实侧聊copy保留了用户输入provenance（来源证据），共享记忆capture仅检查role=user与该标记，因此把历史副本当新的用户输入。普通fork与side共用同一复制/持久sink，所有直接用户入口及Organizer的正常/失败/重启订阅已横向定位。该新共享后端问题尚未修复；下一批优先修正来源分类和实际重跑，不以本轮Goal UI通过替代。原生restart及其他流式入口专项也仍保留。整体持续Goal active，单agent继续。
