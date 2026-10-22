# 权限提示的焦点与主动关闭证据

遵循[Recall/根因/实施/限制](../../records/2026-10/2026-10-22-permission-focus-dismissal.md)。共享Dialog现在将focus离开与主动关闭分开；Esc/外部pointer仍可关闭，非模态仍允许焦点外移。没有改授权、执行或消息协议。

| 实图 | 实际内容 |
| --- | --- |
| [01](01-before-permission.png) | 真实W3C权限及初始焦点 |
| [02](02-before-last-control.png) | 普通Tab到Reject |
| [03](03-before-tab-left.png) | Tab到BODY，提示仍在 |
| [04](04-before-tab-into-page.png) | 再Tab至页面首控件，提示被focus关闭 |
| [05](05-before-restored.png) | 同一持久请求恢复 |
| [06](06-before-escape-closed.png) | Esc主动关闭 |
| [07](07-before-pointer-restored.png) | 原提示再次恢复 |
| [08](08-before-pointer-closed.png) | 外部空白pointer主动关闭 |
| [09](09-before-mdn-permission.png) | 第二URL独立原权限 |
| [10](10-before-complete.png) | 初开成员仍在原历史阅读位置 |
| [11](11-before-final-text.png) | 新四节与结束marker |
| [12](12-after-permission.png) | 正式after真实W3C提示 |
| [13](13-after-last-control.png) | 同样Tab到Reject |
| [14](14-after-tab-body.png) | 同样Tab到BODY |
| [15](15-after-focus-outside-retained.png) | 焦点已在Hide sidebar，原提示继续可见 |
| [16](16-after-escape-closed.png) | Esc仍主动关闭 |
| [17](17-after-pointer-restored.png) | 原请求恢复 |
| [18](18-after-pointer-closed.png) | 外部pointer仍主动关闭 |
| [19](19-after-long-wait.png) | 超过五分钟的同一待决权限 |
| [20](20-after-mdn-permission.png) | 第二指定URL权限 |
| [21](21-after-final-text.png) | 原POST完成后的新四节与结尾 |
| [22](22-after-goal-modal.png) | 未提交的默认modal Goal表单 |
| [23](23-after-goal-focus-wrap.png) | Shift+Tab仍在同一默认modal内环绕 |
| [24](24-after-goal-closed.png) | Esc关闭Goal，另记录返回BODY的后续线索 |

24图全部实际呈现人工查看，无UI自动化测试/fixture/像素断言。before main-95KA8fEn含只读原因日志；正式after main-O1FFGd25，原CSS main-CVd9TkT1。前后正式Node构建分别7314模块/1m8s和1m1s；原类型检查95340 exit0。

[before普通Tab原因](before-console-tab2.json)直接记录focusin→close-request→同一requestID interaction-dismiss，公开initial/after-tab仍同一个W3C待决请求。另有真实[Esc](before-console-escape.json)/[pointer](before-console-pointer.json)对照。before合计10唯一事件，归因不来自最后错误或模型自述。[after人工DOM观察](after-manual-observations.json)记录外部按钮已聚焦而提示保留，以及默认Goal模态焦点边界；默认Goal关闭返回BODY尚未修复，24不能当作返回焦点通过。

[实际结果](result-observation.json.gz)保留两轮原POST200/stop、846/851字符、四节、4个权限requestID及其请求/一次批准/执行成功/自然退休ledger。[长等待公开事实](after-after-budget-wait-pending.json)在dispatch347593ms后仍是同一pending；[原handle](after-long-wait-handle.json)随后仍live。[资源摘要](resource-summary.json)证明原after POST438778ms后正常完成，原86812 exit0；没有重发或用另一个GET替代原连接成功。

实际12/16 Sol（含预检/记忆），全部model/API model gpt-6.1-sol、stream=true、HTTP200、原source EOF，剩余4退休。两原服务/输入exit0、public shutdown200、native physical/output/request/launcher/精确出生链闭合，130/131关闭，8配对凭据成员退休。两原runtime error计数0，仅此运行范围，不外推全部入口。

[原数据结算](data-preservation-observation.json.gz)：源90表156566原行/身份/字段/时间及source bytesmtime、schema3实际对象/integrity/完整canonical保持；两个target各5自然更新原行，Provider activity391→395。完整DB/原行快照/auth/models/无关消息未归档。ledger描述器按requested owner找到request_id后读取全部后果，不能用后果行的空session_id误判生命周期缺失。

helper依赖原529准备来源、413/446原生监督器、504 Source CLI和497冻结Bun，before按parent c5e4fe0ae源执行；原执行位置在.tmp-product-iteration/permission-focus-dismissal-530，不是独立安装器。不声称真实Question、Task/Mission、多项目重启、所有Dialog或所有Rendering资格通过。
