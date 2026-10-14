# 成员侧栏实时呈现证据

[Recall、根因和实施范围](../../records/2026-10/2026-10-14-member-live-rendering.md)。修复共享指导入口的Task适用条件：普通Session成员曾显示Add guidance，提交时必然被“没有活动Task”拒绝。Card、ChatBubble和嵌套成员统一沿现有Task根会话判断；Task协调协议不变，没有失败后改走普通Session的后备路径。

| 实际页面 | 人工观察 |
| --- | --- |
| [01 初始真实成员](01-member-initial.jpg) | 正常委派一个只读成员，短答与README来源自然产生。 |
| [02 原失败](02-guidance-sent.jpg) | 页面提交指导后报缺少Task；文件名中的sent仅指提交动作，消息没有送达。 |
| [03 修后正文](03-member-after.jpg) | 原成员正文、Sources和复制操作可用，按Task范围呈现指导操作。 |
| [04 来源定位](04-source-location.jpg)、[05 返回](05-source-return.jpg) | 实际README第2—3行选中，返回成员原阅读位置。 |
| [06 新流](06-member-live.jpg)、[07 列表往返](07-live-list-return.jpg) | 新流13/37秒时原正文和原Source保持可读，本次未见重复Rendering。 |
| [08 完成态重开](08-completed-reopen.jpg) | 关闭发生于流中；首次重开工具派发超时，再打开时回复已完成，不能计流中重开。 |
| [09 实际复制粘贴](09-source-copy-paste.jpg) | 已知工具剪贴板基准后复制，粘贴为完整真实路径及2—3行；草稿随后清空未发送。 |
| [10 长正文](10-long-reading.jpg)、[11 最终表格](11-long-final-table.jpg) | 12小节和最终Markdown表格可读，主区保留原内容。 |

截图是真实服务`localhost:18527/ui/`的原始JPEG，逐张人工查看。没有UI自动化、截图断言、模型伪消息或手工Source注入。长回复由对既有普通成员的独立公开Session诊断输入产生，这不是新的界面指导发送功能。

[持久化核验](persisted-check.json)读取实际v1数据库：原8条Message和所有原Part/Tool/outcome保持；真实新输入与HTTP响应吻合，最终assistant自然stop并产出2206字元；两份来源各自绑定已完成read和精确行范围。`facts/`保留原始只读数据及真实公开请求/响应gzip。它们证明数据合同，不能替代视觉判断。

[运行结算](execution-summary.json)区分三scope：

- [legacy-rejected](legacy-rejected/failed.json)：390旧库未标schema版本，生产DatabaseUnavailableError拒绝；0模型请求、原exit1，物理/output/request与配对退休完成。未重写版本或删除旧库。
- [before](before/native-host-settled.json)：真实单成员短答、7条Sol流；公开shutdown200、原42056/1114aa exit0。
- [after](after/native-host-settled.json)：复用当前v1历史，5条Sol流；公开输入原55177/d986d1 exit0，公开shutdown200、原31830/7db3eb exit0。

12条实际gpt-6.1-sol流均200/settled/eof；复制凭据与完整相邻模型目录配对验证并退休，内容不归档。`execution/`保存原启动、模型输入、只读checker、构建和结算脚本及日志；Vite初次入口错误、归档首次空Tee文件错误保留，修复工具后重跑成功。已有捕获只与其实际源bytes核对身份，不用源码hash验收。

`previous-411/`保留3aa6db050正常交付的首个CAS失败和fresh fetch/merge后的成功push、远端精确身份。零输出fetch没有生成文件，捕获清单明确给出原工具662d1a边界。

未满足范围：没有两个不同成员切换、当前Task指导实页或完整流中关开组合；没有连续录像证明瞬时零闪烁，不能宣称原Rendering问题全面解决。自有产品页28/29已关闭；启动过早产生的错误页27因浏览器内部data URL策略无法绑定关闭，未标记保留，没有绕过策略。
