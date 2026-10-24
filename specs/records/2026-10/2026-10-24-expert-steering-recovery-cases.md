# 专家团当前源码追加交付与更正场景

## Recall

- 用户原要求：抽几个专家团，设计端到端case，找到机制问题并深入分析后再制定合理方案解决，直到找不到新问题为止。上轮只核旧原件和41项局部合同，不能替代当前源码新的完整业务验收。
- 用户在当前聊天明确授权使用本机已配置OpenAI凭据和完整模型目录，限定全新隔离项目、gpt-6.1-sol流式调用、每服务最多360次请求、不操作现用服务或对外发布。此授权仅用于当前真实端到端场景；不把其他任务记录当成本聊天授权。
- 使用benchmark-debug-template；不委托独立agent。产品内原专家团是被测系统真实成员。当前main起点078d936d4，数据库版本8；保留171项既有删除、两级README其他任务新增入口和两个未跟踪目录。并行Expert recovery审计负责Manager保全/安装接续，当前不修改该分区。
- 已读原机制案例Recall/结果、当前专家团调度、Task控制面、记忆/恢复架构、三个候选原包manifest/README/交付角色/工作流/前驱Schema，以及真实Provider审计、paired目录移交、原生进程监督、正式Task创建/message/conversation和现有真实案例启动/结算脚本。搜索确认Task消息正式入口为server/routes/orchestrator.ts，语义由task-api/index.ts唯一handleTaskMessage负责。

## 问题深度与影响面（实施前）

- 可观察候选：marketing-growth和seo-geo的writer及共享workflow明确固定artifacts路径，sales-strategy等已明确优先用户指定路径。前两包另有绝对“merge后不再修改”而未说明后续授权Turn。它们与当前用户可继续Task的公共合同可能冲突；尚未真实运行，故不宣称产品已失败。
- 直接触发拟为用户指定outputs路径、worker运行中更正原约束、完成后同Task继续交付。数据流需核原operator Message/Parts→接受轮次与root ingress→真实调度/worker读取→实际文件、资源和document→当前completion。不能按标题或模型声称完成定因。
- 尚未知：高优先级package prompt是否实际导致忽略用户路径；新消息是否遗漏/重复；多个项目是否串台；重启是否重新消费原事实。先真实运行，不能从局部测试绿例排除。
- 旧路径未证明根治的原因：原三个自然案例没有覆盖这两个包，局部publisher合同不验证自然语言路径选择和后续更正；之前的恢复矩阵证明共享机制特定切点，不能证明当前新包语义。
- 影响面：原包身份/工具/Skill、Task/Mission/Session轮次、正常及终态、继续/恢复、串并行与项目隔离、单一交付资源及审阅契约。发现任何控制面异常立即横审全部生产入口；此阶段只准备隔离checker和输入，无生产修复或格式变化。若需修改，先补完整根因/定义调用/历史/风险方案，版本更新须同步生成物及实质更新日志。

## 案例与验收

| 案例 | 输入及操作 | 明确输出与事实 |
| --- | --- | --- |
| MG | marketing-growth；三渠道合成数据；原预算3000，首个worker实际运行后由正式Task message更正当前预算1200；请求outputs/growth-plan.md | 完整七类业务产物、真实前驱read/select、独立审阅；输入合计曝光6000/点击370/线索47/成本1900；分渠道线索成本20/50/60；当前预算1200、建议仍为待验证假设；指定文件、发布资源与document逐字一致，原Task完成 |
| SEO | seo-geo；本地三页内容清单及明确缺口，请求outputs/discovery-plan.md | 原包证据→独立内容/技术分析→汇合/审阅/规范交付；只据实际清单区分观察和建议，未知真实排名/流量；原始URL身份及指定交付路径完整，资源/document一致 |
| SALES | sales-strategy；合成客户分组/访谈摘录，指定outputs/sales-playbook.md；完成后正式追加一条预算更正和交付要求 | 原七类业务与独立复核完整；完成事件保留原epoch，追加输入开启新epoch并实际更正同一规范文件，新的交付/审阅绑定新内容；原记录仍可读 |

- 各案例使用fresh根目录和独立服务/项目；先顺序运行以便归因。若出现共享并发或恢复候选，再用两个项目及精确自有进程补原切点。禁止为了完成case提高既定360预算；预算用尽归为checker边界，保留原轮。
- 环境：既有本机auth.json及同目录完整models.json，凭据内容不输出；启动前分别验证registered credential、目标模型投影和实际预检请求型号一致。原Provider reader变化/实际会话/工具/产物变化驱动180秒无活动超时；90分钟仅为自有进程泄漏保护。
- 使用项目开发serve的`/ui`与真实页面交互、截图人工复核，不运行或新增UI自动化。结构checker不能替代数字、来源状态和最终内容复核。
- 结算等待真实Provider reader、原生进程/输出/请求完成后，移除所有隔离auth/models副本并核源保持。原失败日志/SQLite保留。每个逻辑交付更新记录/索引、文档检查、精确提交、fetch/merge、审阅完整待推送集合后正常push；未满足完整矩阵不关闭Goal。

## 当前状态

原输入和私有checker已落盘。MG-01在任何模型调用前因checker逐字符串比较Windows正/反斜杠路径失败；实际同一路径，改用成熟path.resolve比较，原失败原生进程exit1且physical/output/request均settled，两个authority副本已精确退休。该错误不计产品故障。

MG-02已启动：`C:/Users/hengu/.codex/opencorvus-expert-steering-20261024-mg-02`，正式开发服务19140/ui，原Task `tsk_g00VYyaN1P00F4nc7t13`。现有凭据、完整models目录、目标投影及实际gpt-6.1-sol流式预检均通过；360预算在启动前固定。服务启动时Manager保全分区有他任务的三文件修改，完整source.patch保存在该轮evidence，不将运行源伪称纯078d936d4。并行修改不在本任务提交范围。

当前真实根编排器已加载原方法/工作流并开始对原始文件snapshot/read/select；尚未完成、尚未更正预算，所有候选保持未证实。浏览器已通过隔离IAB访问真实/ui并看到原Task运行，没有运行界面自动化。

- MG首次实际planner运行时，正式Task message返回202/accepted，原Message `msg_g0VYybEYq00nKOf6pD1Y`、ingress `art_hWbd5lgSNQ7sEIgM6IU5`，原epoch1；更正完整原文和真实user来源落库，原初始调度保持。此事实只证明接受，不证明最终消费或交付正确。
- 为在真实模型运行期间继续覆盖其他原包，后续独立案例改为可并发启动，每服务仍保原360请求、独立目录/端口/数据库及实际源码差异。它们证明隔离业务运行；不把不同数据库的并发冒称同库多Project调度验收。若出现共享控制异常，再补同库两项目及重启矩阵。
