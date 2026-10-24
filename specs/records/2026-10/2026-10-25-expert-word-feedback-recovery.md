# 专家团完成后分页反馈与服务重启验收

## Recall

- 用户原要求：抽几个专家团，设计端到端case，找到机制问题并深入分析后再制定合理方案解决，直到找不到新问题。上一Goal turn是明确进展：三组真实业务完成，根输入/PDF/历史投影修复及证据提交推送到main，当前HEAD与upstream均为`ec4f2715c`。
- 原营销Task `tsk_g00VYyl3AK00URPjoC7V`在本任务创建的隔离项目完成epoch1；原服务已HTTP关闭、精确原生host/target结算、四份auth/models副本退休。当前只重开这个已由本任务关闭的隔离服务，不操作现用用户服务、VS Code或Office进程。原数据库和项目继续作为一个事实来源，不fork数据库、分支或worktree。
- 当前聊天已有明确凭据授权：仅本任务的隔离验收，现有OpenAI凭据和完整模型目录，`openai/gpt-6.1-sol`流式调用、每服务不超过360、不对外发布。本轮保留原310次审计，再固定最多50次（包含一次真实预检），保守合计不超过360。保持原180秒实际无活动超时，新的30分钟自有进程边界只作泄漏保护；不因为观察到期重启、提高预算或丢弃原轮。
- 使用已应用的benchmark-debug-template与documents Skill，文档后续必须实际渲染、逐页人工复核。根agent不代写输出文件；由原产品专家团接收真实反馈、选择相关职责并完成修订。不得用Host gate或消息合成来编排工具流程。
- 当前保留171项既有删除、两个README的既有顺序差异与两个未跟踪目录。只提交本轮计划、输入、证据和必要的真实机制修复；不混入无关更改。

## 已验证问题与影响面

- 原规范Markdown15834字节、DOCX（Office Open XML文档）10552字节已与实际不可变资源全文/字节核对，Word有9节、81个有序正文块、37段、7表、44行表格。原五页渲染都可读，但第2页末预算表头孤立，第3/4/5页延续表格未重复表头。当前待解是分页呈现，不是数据复算或预算口径错误。
- 实际项目脚本`tools/growth_document.py`以标准库直接生成WordprocessingML；表格行仅有cantSplit，没有tblHeader。Microsoft的[表头接口合同](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.tableheader?view=openxml-3.0.1)说明该属性使首部连续行跨自动分页重复；[Word打印布局说明](https://support.microsoft.com/en-us/word/repeat-table-header-on-subsequent-pages)说明手工分页会改变重复行为。它们说明格式语义，不代替本机实际渲染。
- 当前平台work-artifacts仅声明qualified PPTX，不能把这轮局部Word修订冒称新增通用Word生产能力。原服务最后诚实说明没有Word逐页验收；本轮提供可用的离线验证资源，测试真实反馈能否被自然消费并据实更新审阅和交付。
- 共享链为正式Task message原Message/Part→epoch2/ingress→根编排器和原专家职责→文件修改/真实渲染/独立复核→新不可变资源/交付→Task终态。检查旧epoch1及资源仍可读、同名文件新旧版本绑定正确、仅一份当前正文、真实参与者完整可见。
- 读取已覆盖当前Task生命周期/执行身份/历史投影架构、正式handleTaskMessage/appendAndWakeTaskOperatorMessage、原renderer、paired凭据/目录stage、真实Provider审计及原launcher。全仓定义/调用搜索确认正式消息路径未改变；本阶段不修改公共接口、Schema或调度实现。若发现调度、重启、收尾、队列或轮次异常，立即按全部生产入口、Task/Mission/Session、正常/终态、重试/重启、串并行与Project隔离横审，不能降格为Word个案。

## 输入与明确验收

1. 先确认原host精确进程出现已dead_or_reused、原目录无活跃本任务服务、原Task实际completed/epoch1、规范文件仍等于原资源。保存原MD/DOCX、生成脚本及实际证据页；不修改原产物内容。
2. 把已人工查看的第2/3页PNG（Portable Network Graphics，便携式网络图形）作为真实反馈输入放入隔离项目新目录并独立提交输入。正式消息要求只修文档呈现：跨页首行重复、表头与首条数据同页，正文/预算/来源/数字保持逐字一致；沿原交付资源追加新版本并独立复核。
3. 使用成对auth.json/models.json启动同一个隔离runtime的新出现，在新证据子目录保留startup/原生身份和原audit。分别验证credential可用、目标模型投影、实际流式请求型号；不重装或换掉原Task固定专家团。
4. 正式POST一次反馈，不把收到202等同于完成。不确定提交结果时先读取实际消息/epoch，不盲目重发。原完成事件保留，新轮次必须epoch2；原审阅不得冒充新文档已经视觉验收。
5. 最终MD与原MD逐字相同，新DOCX的段落/单元格有序正文仍等于完整MD，当前文件与新发布资源逐字节相同；旧DOCX资源仍是原字节。所有真实发布/审阅/资源必须由正式artifact-read读取完整内容验证。
6. 用bundled Python和原render_docx.py再次实际渲染最终DOCX，逐页人工查看；测试工具现有官方LibreOffice在私有目录，无须安装或操作用户Office。PNG/PDF仅内部验收资料，正式交付仍为原规范正文和文档。
7. 从真实/ui查看反馈、原参与者、新轮完成和新旧交付；不新增、运行UI自动化。终态后等待全部Provider reader及原生physical/output/request，再正式shutdown和退休四份authority副本；原失败/SQLite/资源均保留。

## 环境和操作

- 原隔离根：`C:/Users/hengu/.codex/opencorvus-expert-steering-20261024-mg-03`；原项目为其`projects/marketing-growth`；新证据/authority在`evidence/word-feedback-02/`。只使用新端口19145和新的startup/host身份，不覆盖原结算回执。
- 凭据源仍为用户已授权的本机配置目录，内容不进入prompt、日志、spec或提交；新authority内保留完整paired模型目录，源的内容和mtime记录后核对。
- 离线工具由workspace dependency loader核实：bundled Python/Node、documents Skill的renderer，已解压官方LibreOffice26.8.1；具体非秘密绝对路径在反馈输入中。唯一新作者是产品内原专家团，主agent只作只读验收。首次作者动作前按documents Skill运行一次edit marker。
- 本轮初始分析和规格没有宣称新的产品故障。完整结果、未满足项和后续根因方案必须在此更新；所有正式交付修改结束前精确commit、fetch/merge、核对完整待推送集合并正常push。

## 原Task追加轮次实际失败与根因

- 正式反馈获202，原Message `msg_g0VYzQg7C00JNyZlTmKP`/Part `prt_g0VYzQg7C00vE8KWlPX5`进入原数据库；epoch2在`1792863534319`开启，保留epoch1的completed事件。新轮在`1792864003235`明确failed，错误为本验收器的`E2E_REQUEST_BUDGET_EXHAUSTED`；不是完成，也不是运行器无活动超时。
- 更早的直接阻塞是实际read Tool `prt_g0VYzRahj00yQMzmgkoo`：读取项目外render_docx.py返回`TaskProcessBoundaryError`。代码`src/tool/external-directory.ts::assertExternalDirectory`读取原Task process binding，并对真实路径调用`assertResolvedTaskPathInWorkspace`；native和capsule均使用绑定根。`read.ts`在文件读取前消费同一检查。现有`test/task-process-file-boundary.test.ts`覆盖根内路径与根外typed error。故不能把界面Full access当成扩展Task目录，也不能让Shell代读外部脚本绕过拒绝。
- 数据流根因属于本次验收准备：只向真实消息列出外部renderer路径，没有把可读脚本交付到Task根。模型真实记录显示先报告阻塞、再检索已投影技能/能力并请求协调，后续环境诊断未找到项目内renderer；这些不是Provider凭据失败。残余额度50不足以完成该调查、修订、实际渲染、独立审阅和新发布。
- 中间状态已核对：规范MD与原Word字节保持原样；作者只修改生成脚本，41行新增、7行删除，隔离项目保留真实提交`c49c3e1`。原Word仍10552字节，不能把脚本修改当作新版交付。原epoch1成功不等于本轮分页修复通过；完整正文、新文件发布与逐页复核验收仍未满足。
- 真实Provider为新50次、旧310次，合计360，不再续用/重置该实验额度。全部reader完成后正式HTTP shutdown成功，原生host/target实际physical/output/request均结算、原始launcher退出0；四份新authority副本已退休，源内容及mtime不变、秘密扫描0匹配。
- 工具自身还有一次已修正的准备错误：最初验收器使用不存在的Task.workflowBinding，实际契约是Task.packageRevisionBinding；错误发生在新证据、凭据副本或模型轮次建立之前，修正后原准备通过。保留这条工具缺陷记录，不归咎于产品。
- 本轮没有观察到新的队列、唤醒、恢复或终态收敛异常；同一数据库正常CLI重启后原Task、package revision及epoch1一致，真实反馈开启epoch2并最终收敛到failed。原共享调度横审与多项目/串并行证据仍见上一记录；本次发现的是确定目录错误及验收依赖缺口，不据此改调度或削弱边界。

## 修正验收准备的后续方案

- 新增一个独立Base专家团用例，使用全新隔离项目/数据库/端口19146，不复制原Task数据库、epoch或预算。输入是此前真实交付的原MD、原Word、原生成器及两张真实问题页，均保存其输入身份；原营销Task失败证据继续保留。
- 先把成熟render_docx.py脚本作为明确的本地验收依赖复制到新项目`tools/render_docx.py`，保留原脚本完整字节，不改写另一份renderer。只在子进程PATH配置已验证的bundled Python、已解压官方LibreOffice和Poppler。先在新项目实际运行原DOCX的只读离线render，得到五页且逐页核对，再建立paired凭据和模型轮次，避免再将依赖可达性留给模型猜测。执行依赖是已授权的本机离线运行时，不将外部源脚本读取改用Shell绕过。
- 新Task只修同名Word和生成器，规范MD全文不变；由Base实际生产者完成生成/渲染及视觉自检，再由独立审阅者复核真实页图和正文，最后正式不可变资源交付。根agent只读取验收，不修业务输出。新用例每服务最多360次、精确gpt-6.1-sol流式、180秒真实无活动边界，与先前授权一致；独立记录原生身份、逐页证据、真实发布和退休。
- 验收指标沿用前述第5至7项，并明确区分新的文档生产用例通过与原Task追加轮次失败；不能用新用例覆盖原结论。若发现产品机制问题，先补完整影响分析与实施方案，再改生产代码并复测。

## 新用例的实际准备与运行发现

- 新隔离根`C:/Users/hengu/.codex/opencorvus-expert-word-base-20261025-01`，实际Task `tsk_g00VYzV4d60044VaYioJ`、Project `prj_hz4MUTMNoi0ikRKumyKx`。生成前原件已经通过项目内renderer实际渲染五页，主agent逐页查看，复现了原表头问题；之后才建立paired authority并进行Provider预检。实际gpt-6.1-sol流式预检成功，正式Task创建202。
- 准备器曾错误把Base当成市场payload package安装，返回`Expert squad market package not found: base`。仓库`src/expert-squad/builtin/index.ts::getLoadedBuiltInPackages`已经是唯一内嵌Base事实来源，市场安装接口只消费payloadPackageSources。修正验收器使用原内嵌声明，不为Base增加市场副本或产品兼容分支。错误启动零模型请求，原生结算、原launcher退出1和四份authority退休都保留于`base-case/rejected-startup-01/`，再用新物理occurrence重启同一尚未创建Task的新用例；不是重置已消耗模型预算。
- 原生成器还有一个局部可移植性问题：`verify()`依赖旧项目campaign.csv，首次实际build后自检返回exit1。新Task没有业务重研输入，该生成器验证的外部依赖与本轮文档呈现职责不匹配。产品内Task owner自行删除旧CSV依赖并保留与原MD字节、原Word有序正文的完整比较；不补造旧业务数据，不据此修改正文或把失败覆盖为成功。原命令及后续exit0结果通过正式`GET /session/{sessionID}/message/{messageID}/part/{partID}`读取完整Tool事实保留，避免把conversation的deferred摘要当原输出。
- 独立角色`base-tester`已自然接受真实dispatch，并独立执行正文核对、修改范围检查和实际重渲染。其尝试用文本read直接读取原DOCX产生`Cannot read binary file`，这是当前read的格式契约；原错误保留，随后消费实际不可变资源及提供的文档解析/渲染路径。DOCX不因本次局部生成器存在而成为平台已qualified的通用文档能力。
- 本阶段不修改生产接口、数据库、公共权限或队列。目录错误修复落在验收输入准备；原Word布局由产品内真实作者在生成器与实际文档中修订。最终状态、正式资源、独立审阅、主agent逐页复核以及关闭/退休仍须完成后补证。
- 实际Base完成不是业务包typed campaign-plan路径：当前`task_completion_decision`与Task terminal时间精确一致，其`deliverable_artifact_locators`直接绑定一个正式TaskArtifact snapshot，树内恰为Word和MD两文件。验收器按`02-data.md`及`plugin/task-artifact.ts`的当前公开合同读取原Completion Decision、完整manifest及资源，不假设只有`expert_output`才是交付，不增加typed报告或第二交付事实。独立`base/test-report`仍单独完整读取作为审阅证据。

## 最终结果与证据复核

| 用例 | 实际结果 | 交付资格 |
| --- | --- | --- |
| 原营销Task同库重启后追加 | epoch2失败；原310次加本轮50次=360；MD与Word保持原件，只有生成器中间修改 | 原失败及未完成项保留，不能宣称分页修订通过 |
| 全新Base文档修订 | epoch1在`1792866062416`完成，原终态事件`pev_g0VYzbIQF00jml7yuOZC`；92/360次全部gpt-6.1-sol流式、全部reader settled | 正式Completion Decision、完整manifest、两个资源、阅读版及独立审阅均通过真实接口全文读取 |

- Base正式snapshot为`2ac585a9-f2a1-5795-abd7-640f0b57ba71`，正向资源集合恰为`outputs/growth-plan.docx`10474字节、`outputs/growth-plan.md`15834字节。每个资源完整分块HTTP读取后与当前实际文件逐字节比较。规范MD同时与本轮验收输入和此前真实交付原件逐字节相同，原Word输入也与前次真实原件相同，renderer保持原始完整字节。
- 真实阅读版`art_g0VYzb8hF00mHF1kRJYX`的`document@1`记录由其原Session接口读取，全文与规范MD相同。独立解析采用marked词法器与python-docx，比较全部81个有序块、37段、7表、44表格行；七表均有实际重复首行属性、表头keep-next及每行cantSplit。属性检查不代替视觉结果。
- 主agent从当前实际Word复制只读渲染源，用原documents Skill renderer和独立LibreOffice profile重新渲染五页并逐页查看。最终正式Word又与该渲染源完整字节一致，形成真实发布→真实文件→本次渲染→逐页观察的链。第2页预算表头整体移走，第3页表头与300元首行同页，第4页阶段表重复四列表头且V3/V4完整，第5页未知清单与结尾完整；未观察到裁切或重叠。所有页图保存在artifact `base-case/word-pages/`，不是正式业务交付。
- 独立报告`art_h0sL9638oX8lpK7UfWZs`完整读取，verdict为`accept_pagination_revision`，五页逐页观察、原错误、复核命令和边界完整保留。审阅者并非用五次本地read读取最终图：实际通过一次artifact_read批次接收五份完整PNG及五个真实message-owned附件。导出器最初误按本地read路径统计为0而失败；修正为在原生服务结算后用只读SQLite读取精确request/outcome，核对原Message/Session、真实locator、完整0→total_bytes区间和五个image/png附件，重新导出通过。原导出器错误保留于`export-checker-correction.json`，未合成read调用或改动产品证据。
- 实际`/ui`打开同正文阅读版并查看完成状态和两个正式文件卡片；`02-reading-document.png`、`03-base-task-completed.png`、`04-final-delivery-files.png`保留真实页面。未新增或运行UI自动化；文档页图的重渲染一致性也不被当作产品UI或人工视觉验收。
- Base实际产品修改提交`d6531a7`，最终隔离项目快照`5c9a533`且Git状态干净。主agent没有代改该Word或生成器。
- 两个有模型服务和一次零请求启动失败均由其原生host/target物理结算。原营销追加与Base正常HTTP shutdown、原launcher退出0；零请求工具错误原退出1也保留。共三批、12份临时auth/models副本已退休，源内容及mtime不变，导出的本轮全部证据对真实复制的access/refresh扫描0匹配。未发布服务、Release或版本。
- 用户随后授权仅结束VS Code PID65608启动的那批Mermaid rg检索。`2026-10-24 17:48:30 UTC`重新核实该owner仍是原Code.exe，但满足原完整参数的rg子进程为0；未结束用户VS Code或其他进程，也不据此宣称CPU改善。

## 验证与当前限制

- `bun run test -- test/task-process-file-boundary.test.ts`（packages/opencorvus）：1项、3断言通过，证明根内路径及根外typed error契约；这是聚焦后端合同，不冒称真实模型端到端。
- `verify-base.ts`：正式Task、Completion Decision、完整manifest/资源、实际阅读版和原始字节全部通过。`verify-base-word.py`：完整正文及表格属性通过。`archive-base.ts`：原导出器路径假设修正后通过，五份独立真实媒体回执齐全。
- `docs:check`与`check:architecture-index`通过；最终提交前对本轮新增记录及索引再次执行当前文档检查。
- 本轮已修正验收依赖准备并获得独立Base成功实物证据，没有观察到新的调度/恢复/终态或文档发布机制异常。此前三组真实业务及根输入、PDF、历史投影的共享机制修复继续以[原记录](2026-10-24-expert-steering-recovery-cases.md)和实际提交为准。本轮没有再修改生产机制。
- 仍未证明原营销Task在正确依赖准备下的同Session分页续修能够完成：其累计预算已达360并保留失败，不重置额度。Base成功不能改写原轮结论。此次Word生成器是具体项目产物，不是平台通用Word capability资格；也未验证所有Office环境具有完全相同分页。以上是明确覆盖边界，不声称全项目没有其他缺陷。
