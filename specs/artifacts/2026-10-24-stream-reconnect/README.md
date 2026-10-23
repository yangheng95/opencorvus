# 服务替换后的流恢复

[方案与根因](../../records/2026-10/2026-10-24-stream-reconnect.md)，[结构化运行事实](evidence.json)。560由单agent在真实source CLI（命令行入口）`/ui/`、内置浏览器手动操作和截图人工查看完成，没有UI自动化测试。随机隔离端口53783，用户正在使用的进程、窗口及数据库未参与。

## 已确认根因与修复

全局Work Ledger/Mailbox流自己的重试先恢复连接，健康恢复和工作区投影刷新随后各调用一次start；旧实现每次无条件关闭当前连接。补充Sources恢复单页实际建立三次全局流，反复触发connected及规范数据重新读取。修复只保留一个当前应用程序接口（Application Programming Interface，API）authority的owner，重复start保留该连接；显式stop、失效authority和真实断开继续正常收敛。

新真实生产网络测试先在旧实现失败：重复start后预期的规范Session标题更新被新的connected替代；修复后生产网络2例24断言、socket9例50断言、Host通知1例9断言均通过。两package类型检查、Node正式UI构建及文档检查通过。修复前完整入口main-C7aBtTu6.js；修复后main-HBKlRKaR.js。构建后仅收回无关格式差异，没有后续运行语义变更。

## 人工视觉证据

| 图片 | 实际区域与边界 |
| --- | --- |
| [01](01-member-before.png)、[02](02-sources-expanded-before.png) | 第一服务：成员会话、工具展开和原输出读位。02不是可见来源卡片资格。 |
| [03](03-mission-before.png)、[04](04-conversation-before.png)、[05](05-side-before.png) | 另一项目Mission、普通Work会话、Side各自未发送草稿。 |
| [06](06-member-offline.png)、[07](07-side-offline.png) | 正常关闭第一服务后保留原页。07按钮瞬间未采真实属性，不判断其机制。 |
| [08](08-member-reconnected.png)、[09](09-mission-reconnected.png)、[10](10-conversation-reconnected.png)、[11](11-side-reconnected.png) | 原四页无刷新自行恢复，原工具、正文位置与独立草稿保持，认证可用后提示自动清除。 |
| [12](12-real-sol-after-reconnect.png) | 明确新对话入口后真实gpt-6.1-sol流式回复“重连后流式回复正常。”，没有覆盖原Task草稿。 |
| [13](13-side-offline-property.png) | 第二次离线实际按钮disabled=true；不是靠截图外观推断。 |
| [14](14-tool-output-before-collapse.png) | 补充验收中间态：工具输出仍展开，不作Sources通过证据。 |
| [15](15-source-card-before.png)、[16](16-source-card-offline.png)、[17](17-source-card-reconnected.png) | 修复前传输版本，同一成员的可见来源标题、域名和复制控件在服务替换前/离线/恢复后保持。原始请求揭示三次全局流重建。 |
| [18](18-fixed-source-before.png)、[19](19-fixed-source-offline.png)、[20](20-fixed-source-reconnected.png) | 修复后新完整构建，保留页216，实际正常关闭/替换服务，不刷新、不改设置。Sources和原读位保持；全局连接一次建立持续到正常关页。 |

## 完整运行结算

六服务分别拥有20分钟原生父进程边界、180秒启动无活动检查及五分钟收尾预算。以下均公开shutdown200，原始exec、精确原生/launcher进程链退出0，physical/output/request完成，复制模型目录退休；唯一复制认证的after也退休auth。原始请求只记录method/path、来源、浏览器身份、规范stream ID及ticket目标身份配对，不包含票据、凭据或正文。

| scope | 原始exec | 流实例/全局实例/峰值 | 模型请求 | 关闭时剩余预算 |
| --- | ---: | --- | ---: | ---: |
| before | 8291 | 9 / 4 / 9 | 0 | 880283ms |
| after | 12924 | 23 / 12 / 11 | 4 | 707821ms |
| sources-before | 6147 | 2 / 1 / 2 | 0 | 1099073ms |
| sources-after | 58885 | 5 / 3 / 2 | 0 | 1112487ms |
| fixed-before | 15990 | 2 / 1 / 2 | 0 | 1143516ms |
| fixed-after | 98631 | 3 / 1 / 2 | 0 | 1151292ms |

全部44条规范实例均与短ticket请求配对并在关闭时abort，最终active为空；各scope原始请求见[before](before-requests.jsonl)、[after](after-requests.jsonl)、[sources-before](sources-before-requests.jsonl)、[sources-after](sources-after-requests.jsonl)、[fixed-before](fixed-before-requests.jsonl)、[fixed-after](fixed-after-requests.jsonl)。峰值和累计实例是不同对象；after包含五页，不能把12次全局实例称为正常单一owner或泄漏。fixed-after的另一次选中Task流重绑定属于工作区恢复，和本轮全局owner修复分开记录。

after使用用户授权的当前OpenCorvus完整OpenAI认证条目及完整相邻模型目录，启动前分别验证凭据可用、目录投影和实际api.id。四次实际请求均gpt-6.1-sol、流式200且原Provider响应reader EOF（End Of File，数据读完）；最大六次，未耗尽。其他五scope不复制认证、模型请求零。所有复制目录和认证均已退休。

第一源90表170855原行保持，before目标原行也保持；after仅两条运行容量租约的lease/owner/acquired/expires变化，Provider活动423→425。补充及修复两对各172483原行全部保持。每份源DB字节数、修改时间、所有原行字段/时间和canonical配置保持，原Task/Mission/Session/Goal保持。工作区并行增加的迁移4不属于此提交：fixed-before隔离副本实际3→4，唯一新增schema对象为bus_publication_outbox_message_move_idx；fixed-after4→4。两者无原行差异，integrity ok；不宣称新副本仍是schema3，不禁用迁移，不接触用户DB。

## 保留边界

本轮证明共享恢复时的全局连接重复重建根因及修复，不能把它扩展为所有Rendering现象都已根治。尚未实际验收原生restart按钮与handoff、MCP（Model Context Protocol，模型上下文协议）、VCS（Version Control System，版本控制系统）和panel POST真实模型发送专项。559首次UI之前的直接HTTP调用者身份仍未知；本轮随机端口的全部观察流均已配对。旧Side第一次离线瞬间按钮外观机制仍未知，后续真实属性正确，无无证据按钮补丁。整体持续迭代Goal保持active。
