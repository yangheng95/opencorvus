# 持续目标保存失败与终态入口

2026-10-30，单 agent。真实开发服务 `/ui`、内置浏览器交互和十张原图逐张人工复核；没有新增或运行 UI（User Interface，用户界面）自动化测试。正式普通前端由 main-DIncBPIS.js 更新为 main-DYdWYk7e.js。

## 修复与页面证据

在真实已关闭 Mission 创建持续目标时，原 POST 返回 HTTP（Hypertext Transfer Protocol，超文本传输协议）409 / ContinuousGoalError / owner_unavailable，随后 GET 为200/null。原页面把保存失败显示为“无法确认当前目标”，Retry 仅重读；当前控件明确更改未保存，Review goal/查看目标回到原创建表单，保留目标文字、5000令牌和3轮预算。错误原始详情、所属对象准入与执行行为保持原合同；没有自动重放、更改 Goal 或恢复 Mission。

| 原图 | 实际范围 |
| --- | --- |
| [01 原创建表单](01-closed-mission-create.png) | 真实 closed Mission 的准确归属与填写内容。 |
| [02 原保存错误](02-closed-owner-error.png) | 准入拒绝且表单保留。 |
| [03 原错误混淆](03-save-error-called-read-error.png) | POST409详情上方却提示当前目标无法确认、仅提供读取Retry。 |
| [04 已完成Task](04-completed-task-scope.png) | 当前 completed Task801 的目标表单准确归属，未提交或续跑。 |
| [05 修复后反馈](05-save-error-review-action.png) | 明确更改未保存，并提供Review goal。 |
| [06 实际回表单](06-review-preserves-objective-budgets.png) | 原目标文字、5000令牌、3轮及展开状态恢复。 |
| [07 中文保存错误](07-chinese-save-error.png) | 新正文和查看目标按当前语言呈现。 |
| [08 中文回表单](08-chinese-review-restores-draft.png) | 实际点击后恢复相同草稿和预算，焦点回目标输入。 |
| [09 普通Session身份](09-generic-session-link-rejected.png) | 普通POST/session元数据不具有原生Chat身份，Chat读取404；不能冒充归档或Goal读取反馈。 |
| [10 归档原生Chat](10-native-archived-empty-view.png) | 改用正确原生Chat创建入口后，归档的真实链接显示缺标题和归档说明的空视图；保留后续调查线索，不称Goal读取错误复核通过。 |

实际保存拒绝的覆盖限于创建操作；已有目标的更新冲突、读取和保存同时失败、首页提交失败没有在本轮独立触发。读取错误的原Retry沿用，当前读取错误优先呈现、读取成功后保留原保存错误；类型和构建通过不能替代上述未运行页面矩阵。

## 运行与数据

源为完整802-after历史，schema（数据库结构版本）9/92表/203938条；before203940、after204260。每份副本的全部203938原行保留；追加原生SQLite EXCEPT对照覆盖完整BLOB（二进制大对象）与含空字符的TEXT值，避免Node.js SQLite字符串读取截短影响证据。SQLite完整性和外键均通过。新增两空Session和9个仅属于它们的创建/更新事件；66条投递各有succeeded回执、66份对应投递租约在同一回执时间释放，27份阶段回执完整。每个native各一份精确runtime_process身份收据已对应出生身份死亡；不是未结队列。

源六个namespace的81文件全部字节相同。每份副本中75份已发布文件字节相同；三个802未发送暂存文件及其metadata由实际AttachmentStore.sweep清理，原native日志分别记载deleted3/bytesFreed74/kept5。实际代码的60秒并发写保护与持久引用集合说明该清理；没有还原垃圾文件来迎合检查器。三个QA项目16个tracked文件、HEAD、分支、index和工作区保持原样。

首个诊断运行器错把长驻服务的stdout静默当命令超时，原exec68750 exit1；原运行器确认物理/输出结清，精确native链和端口已关闭。该失败被保留，不能宣称正常shutdown200。改用原有exact-process期限监管的全新candidate，仍用原803截止，实际安静运行约470秒后公开shutdown200，原exec82003/native/launcher均0，物理/输出/请求完成；距原截止564824毫秒。全部自有页已关闭，两套auth/完整模型目录复制均退休，源auth metadata、catalog metadata及字节一致。

本轮Provider请求0、累计1083。只验证已复制OAuth（开放授权）注册与模型目录精确投影openai/gpt-6.1-sol，没有真实模型可用性或目标续跑验收。用户18571与真实用户数据库未操作。

正式构建及renderer检查、overlay类型、2语言2629键、文档351操作/26组通过。原始命令输出按UTF-8无损JSON保存，不剥离ANSI或换行。原始数据库、全行快照和凭据不归档；[方案及完整边界](../../records/2026-10/2026-10-30-goal-terminal-owner-experience.md)。

## OpenAPI 推送检查及 SDK 并发恢复

首个正常push全仓类型通过，OpenAPI检查因另一批已修改的工具期限说明与生成文件不一致而拒绝；原输出/exit1保留。该批随后提交bcc14ace8，正式生成的两处注释同步由独立c357af62e交付。本轮同时调用正式SDK生成，和对方22:13:50.564Z→22:14:21.432Z的实际命令发生竞争，自己的原sdk-sync在22:14:21.620Z以.tmp-sdk-build/dist缺失失败，不能称通过。

当前build.ts把共享编译目录的生成/清理移入既有DurablePublicationStore发布事务build回调，复用同一个subject lock；没有第二锁或生成路径。两个现有正向跨进程/完整发布测试2pass/4断言；两个同时启动的正式SDK build原exec93576/98808均exit0，完整类型发射和产物发布通过，生成树相对c357af62e干净。原api:routes-check复验6规则/36文件通过，文档351操作/26组通过；完整原始输出及命令区间另附sdk-*和api-after-sdk-*文件。

SDK检查使用隔离运行时，没有模型请求或用户数据库迁移。初始失败、对方生成回执和修复后的两次成功分别保留，不用成功覆盖旧错误。此为非UI工具链修复，未重跑或新增UI自动化；上方十张实页仍对应相同产品UI。
