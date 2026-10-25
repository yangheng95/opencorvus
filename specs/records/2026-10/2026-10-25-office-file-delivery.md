# Office 文件交付完整体验

## Recall

用户要求持续、单agent自主迭代当前UI/UX（界面与体验）和功能完成度，真实体验验证后提交推送，仅实际冲突无法安全取舍时等待。旧Rendering调查已关闭，不重启。上一轮2cbd28196已推送普通文本下载与草稿能力，实际CSV、Markdown、附件、空草稿和换行验证通过；二进制Office成果尚未覆盖，不能把文本结果扩大为所有交付格式完成。当前HEAD为该提交，保留现有CI与索引排序等无关改动，不委托、不建分支/worktree，不操作用户18571及用户数据库。

已读上一轮Recall/结果、现行07-panel文件阅读与Artifact交付合同、02-data附件namespace合同；搜索File routes、FileContent二进制分类、FileEditorPane、ArtifactResourceDownload和conversation-artifact。当前普通文件读取对非图片/PDF二进制返回空content的描述，Artifact资源另有绑定Task的完整字节读取，不能将空预览误当原文件。实际Word/Excel路径的页面表现与唯一正确修复点尚待验证，不提前增加读端点或复制Artifact协议。沿用已应用的computer-use和benchmark-debug-template，UI禁用自动化测试的用户硬约束优先。

## 实施前方案

1. 从已关闭的593-after自有完整schema8数据创建新独立runtime，继续原Chat和自有项目；原附件namespace完整复制，原数据与交付文件不改写。当前工作区由Node正常构建，原生开发CLI经54098/ui手工验收。授权OpenAI凭据与完整模型目录成对准备，先分别验证凭据、精确gpt-6.1-sol投影及实际流式调用。整个594最多24请求，包含预检及后台，不能因观察超时重置。
2. 在原真实Chat提交新的Office格式请求：依原工时CSV生成周报.docx与工时汇总.xlsx，保留原四模块状态和36/25/−11合计。由实际模型和原工具生成，不用脚本替代或伪造消息，不创建Task/Mission或其他成员。真实页面检查交付文件卡/正文链接、打开、预览或类型说明、下载、中文文件名和有意义的失败反馈。读取真实下载的ZIP/Office内容核对数据；视觉须呈现和人工查看，不用DOM文案断言冒充。
3. 发现缺陷后先补现象、触发、根因、旧路径遗漏、全仓定义/调用/同语义路径/公开合同/数据/测试/文档/交付风险，再改唯一当前实现。非UI改动用聚焦正向真实合同；纯UI采用新正常publication、实际交互与截图。发现调度/终态等异常立即按共享机制横查，不能归因模型或偶发。
4. 自有原生服务20分钟物理边界，提前至少五分钟公开关闭，原caller/native/launcher/输出/请求结清后成对退休副本；不操纵用户进程、不改schema或清空数据。达到当前路径验收后再检查相关checker，文档三索引和产物README同步，精确提交、fetch/merge上游、完整待推审查并正常hook推送。整体迭代目标保持active。

## 当前状态

真实54098/ui继续原ses_-zUQxA1lPzzUZFA4CCxZ提交Office请求。预检在原逻辑请求重试后成功，实际凭据/精确Sol/流式200成立；但业务请求随后多次socket关闭，最终页面真实Not running并显示APIError，两个Office文件均未生成。当前共21/24尝试，19个fetch_failed、2个200/EOF，计数和原请求不重置。记录证明连接被关闭，具体外部关闭原因未知，不能声称已修复网络或Office流程通过。没有观察到新的排队/恢复/终态收敛异常，正常重试和最终错误保持原事实。

## 真实问题与修改前分析

原页面截图01证明：业务失败后仅显示“Error details”及Cannot connect to API / socket closed / pass verbose:true in fetch的原始开发诊断，没有用户可执行的说明。完整英文SDK提示充当整个错误正文，用户无法从产品反馈理解这是一次响应失败、下一步可以展开诊断或发送后续消息。这是当前失败反馈的UI缺口，与原始连接失败不是同一根因；本轮不通过静态猜测修改Provider、重试策略或端点。

直接入口是ChatBubbleFailureState/每条CardParts messageFailures共同使用的AssistantMessageFailure。当前该组件将card.error_reason_title当主标题，props.reason当默认全部正文；只有额外props.details存在才展示诊断折叠。底层APIError恰好只有reason时，折叠入口也不存在。旧取消展示修复（2026-10-23-cancellation-presentation）解决真实MessageAbortedError的中性样式与取消分类，旧错误归属修复保留原reason；这些没有处理非取消错误的人类操作提示，因此缺口仍在。没有以最后错误状态推断网络根因。连接关闭发生在HTTP响应前，具体原因仍未知，包含本地传输或远端因素，不能归责某一侧。

已全仓定位AssistantMessageFailure全部两个消费者、CardErrorReasonIndicator的复制原文、tree-writer/Side chat现有errorReason/errorDetails投影、CardParts逐Message归属、原CSS和两locale键；读现行07-panel错误保真/消息身份与共享Feedback合同、旧取消决策。组件只收到既有reason/details/cancelled，不包含足以分类全部Provider原因的typed code，因此不按socket文案/关键词推断可重试性，也不新增平行错误状态。

实施限定：在同一共享组件中，非取消错误使用当前语言“响应未完成”和“展开错误详情…可发送后续消息继续”的通用操作说明；原reason及额外details按现有复制顺序完整进入可展开错误详情。已有复制控件继续复制完全相同原文，原Message/终态/原因/权限/队列/重试不变。取消路径继续保留原停止标题、原因正文、中性样式及原额外详情，不将取消改成失败。仅组件和中英locale，沿用Disclosure、现有样式，不创建新错误协议、消息或服务逻辑。

公共UI风险为原诊断被丢失、取消回退和英文固定文案；通过新正常publication重放这一条真实persisted APIError，实际展开原错误并复制完整文本、中英截图确认，原数据与failure归属逐字段回读。相关路径未发现现存DOM/组件UI测试，不新增或运行UI自动化。纯UI没有非UI算法/API/schema迁移改动；Office业务验收继续明确未完成，后续在凭据/实际请求可用时进入，不能用本次反馈修复替代它。

## 实际修改与验收结果

共享AssistantMessageFailure改为当前语言的响应未完成说明和后续消息提示，所有非取消错误都有原始错误详情折叠。原reason和details按原复制顺序保留，取消分支保留原停止原因/额外详情。本轮仅3个生产UI文件和现行07-panel展示合同，无Provider、错误协议、消息数据、schema或重试改动。

前后都是普通Node构建，无诊断插件/断言：main-B11LDDBn.js至main-iCwpdYAN.js，分别48秒/58秒。after继续原Chat与真实失败Message msg_g0VZ2wpXK000NgH71sc6。实际英文默认显示Response did not finish及继续提示，展开Error details后完整显示原socket诊断；中文显示响应未完成/操作提示/错误详情，点击和键盘Enter均能展开原文。五张截图由本agent实际呈现并人工查看。普通文字提示已翻译，SDK原始诊断按真实内容保留。

复制按钮实际完成生产navigator.clipboard.writeText，页面显示Copied；但CUA（Computer Use Automation，计算机操作自动化）工具的虚拟clipboard.readText为空，Control+V明确报告虚拟剪贴板无数据，无法用该工具回读浏览器写入的系统剪贴板。未改写产品或复制函数绕行，也不将其记作复制文本端到端回读通过。原完整文字由真实详情展开及持久化Message并列证明；复制函数和其reason/details入参契约未变。本轮也没有另发取消任务，取消的本次运行视觉回归未执行，保持原实现分支与既有取消验收边界，不扩大声称全部状态已复测。

Overlay类型、2语言2539键检查已通过；没有新增/修改/运行UI自动化。Office业务仍未完成：原业务Message APIError.data保留isRetryable=true与原Responses URL，两个目标文件均未创建，旧周报.md和工时汇总.csv原字节保持。后续优先追查同一Work请求的真实传输事实，并继续Office交付流程，不能将这一UI修复当作Office功能全通过或认定所有连接错误来自远端。

before/after均公开shutdown200，原exec13609/51270与native/launcher退出0，物理/输出/请求完整结算，关闭余量605564/951683ms。before21次中19次fetch_failed、2次200/EOF；after另有1次真实200/EOF，明确归属agentID=memory、requestID=msg_87524f6f-9b3f-42b3-9106-e5d360dd5773，不是Word/Excel业务重试，整594共22/24，未重置。四份auth/models副本退休，原认证大小/mtime及目录原内容/mtime保持。自有页276/277关闭，用户18571与用户库未操作。

源库schema8、92表4993原行逐字段、源库字节/mtime及canonical配置保持，两库integrity正常。目标中的Project/Session/Message/Part/错误原文及原文件保持；目标正常Memory organizer消费1条user_message memory inbox及其chunk，更新同一Project MEMORY.MD内容和时间，并产生真实bus/lease/usage事实。因此不能声称目标全部原行不变。原request context、memory.organizer成功日志、ProjectMemory.commitOrganizationInTransaction在同事务写canonical document后按coveredFileIDs删除inbox的现行代码共同证明这些派生记忆变化；不是本UI改动或schema迁移，原用户Message保持。精确差异留在私有closed-differences-private，公开摘要如实列出变化。
