# 销售经理 Word 审阅稿真实交付

## Recall

- 用户要求持续独立批次迭代，直到明确停止；本人分析、实现、真实桌面交互和截图人工复核、聚焦正向测试、范围提交、普通合并上游并推送。不使用子 agent（代理）、分支或工作树，真实流式 GPT-6.1 Sol 已获现有凭据与完整模型目录授权，不限制模型请求。发现问题必须先完整根因/影响分析落盘，不凭模型自述或最后错误状态判断。
- 上批 `7dd633885513876bdc5603bb3f09cb4faebe8183` 已正常推送，当前本地与上游差距0/0；两原运行均已退出0、原句柄结清、成对凭据副本退役。实际可编辑XLSX交付正确，页面已明确显示当前PDF预览文件名。原177条无关状态保留、暂存区为空，本批开始重新检查了当前事实。前一Goal（持续目标）轮次为进展：真实交付、产品修复和推送均已发生。
- 已重读上批Recall/业务与视觉结果，AGENTS（仓库工作规范）、benchmark-debug-template（基准调试技能）、computer-use（桌面使用技能）、当前Office作者/检查/校验/交付和HTML派生渲染、精确profile（能力配置）/公开工具、生命周期及文档引用、Office原生生命周期正向测试。全仓检索DOCX/office.document、渲染定义/调用和现有历史。当前公开能力为 `office.document@1`：新建1–60段、每段title/heading/paragraph和纯文本；无表格、图片、模板、编辑旧文档。不得用应用内文档/PDF替代所请求DOCX，不绕过原Work能力执行Office运行时。
- 阅读了 `specs/current/architecture/07-panel.md` 的规范文件下载/预览合同，并定位当前平台文档 `17-code-work-agent-platform.md`；最初推测的14-work-platform路径不存在，已用真实文件列表纠正，不建立平行文档。前端/数据事实均来自实际源码和已发布产物，当前没有新缺陷，不先改产品。

## 本批任务与可判定验收

- 从已完成真实Work（通用工作）会话 `ses_hXaoxvf6sXUeNwnhrZTA` 自然追加请求，重新读取项目原始 `sales.csv` 并独立复算，制作面向销售经理的中文 `deliverables/销售经理审阅稿.docx`。内容约1000–1400汉字，清晰标题、来源与范围、计数/净金额口径、每笔原记录、分区及总计、退款/零金额、谨慎业务解读和可执行核对事项；使用普通段落/标题，按原公开能力生成，不要求表格或不支持的排版字段。
- 原五笔A001–A005及所有原始文字/行序与金额应保留；总5笔/35.60，华东3笔/28.25、华南2笔/7.35，退款1笔−2.05、零金额1笔，两者均计入订单数。源数据未给日期/币种/成本/目标，正文须据实说明，业务建议不能伪称为已有事实。原CSV（Comma-Separated Values，逗号分隔值）、代码、测试、JSON（JavaScript Object Notation，数据交换格式）、报告、区域CSV及上批XLSX按原字节保留。示例项目不提交或推送，不创建Task/Mission（任务/编排会话）或子代理。
- 模型自然调用现有作者→检查→校验→看全部实际PNG→读取派生PDF→交付，使用最终实际收据；普通write（写入工具）按附件原字节保存项目DOCX。校验工具直接提供的多模态PNG是实际模型看图输入，不要求再造重复读取。不得由验收宿主补产物、消息或收据。
- 独立checker（检查器）读取规范附件、真实工具和最终收据、实际项目文件及浏览器下载，以OOXML（Office Open XML，Office开放XML格式）解析全部段落/顺序/样式及原事实，以PDF文本/页数核对预览正文覆盖和页面边界。附件/项目/下载之间逐字节核对同一不可变二进制身份；不以可变源码摘要或无意义摘要格式检查代替功能。
- 本人进入当前开发服务 `/ui/` 真实点击查看全部页、缩放、展开/收起、原DOCX和PDF下载及当前预览文件名。保存与实际区域绑定的截图并人工看图，预览长文不能丢尾段或有截断。中英文产品控件保留文件/模型原文。禁止新增、修改或运行UI（User Interface，用户界面）自动化测试、DOM（Document Object Model，文档对象模型）/源码文案断言、组件/快照/像素检查；现有非UI局部测试不能冒充端到端或视觉证明。

## 环境、超时与证据

- 仓外 `%TEMP%/opencorvus-iteration-20261127-sales-document` 保存本批初始状态、原数据/文件事实、检查器和运行句柄。复用上批已正常退出的同一隔离项目和数据库；Office宿主沿用上批正式清单验证过的五个受管文件和同字节Bun副本，不替换用户安装。仅启动自有开发服务，不单独启动Vite，不操作用户其他进程/窗口。
- 现有授权凭据和同源models.json成对复制，启动请求前分别验证凭据、精确Sol目录投影和实际流式模型。原凭据不刷新、秘密不写日志/提示/规格/提交。运行正常结清并join（等待原进程完成）后实际退役副本。180000ms无活动才调查，定时查看原句柄/真实消息/工具事实；60分钟服务寿命只用于本人物理清理，不作业务总时长或请求额度，不因观察超时重启发生轮次。
- 若发现调度、队列、唤醒、恢复、并发或终态异常，立即按共享机制横向审计全部生产入口、Task/Mission/Session（任务/编排/会话）执行轮次、正常和终态、重试/重启、串并行及多项目隔离。当前没有此类异常证据。

## 调查、修复与交付边界

- 本批主要待证风险为长中文正文生成/源回读、段落样式和真实多页预览、页面边界完整性、规范收据与最终文件对应、后续消息/原历史归属、原件下载和语言身份。当前根因未知；发现后补齐现象、触发、数据/控制流、旧路径未根治原因、全仓定义/调用/同语义/历史、合同/数据/测试/文档/交付/风险后再改。
- 非UI改动必须补聚焦正向真实契约测试，工具链问题先修复并重跑同一验收。Office产品渲染器内部浏览器是在生成用户文档的PNG/PDF，不是产品UI自动化测试。触及测试若为UI自动化必须删除且不运行；不无目标跑全量测试，不用后备实现掩盖失败。
- 新规格和产物同步三索引各一条链接，运行当前docs:check（文档检查）与架构索引检查。只提交本批，保留177条无关状态和脏索引的无关差异；正常获取/合并上游，审查完整待推集合并普通推送，不绕过hook（钩子）、不变基/强推、不发布版本或Release（版本发布）。

## 实施前根因与共享影响分析

- run13原请求自然执行13次Work模型请求，加2次真实预检；源码Office作者产出7997字节DOCX，原生inspect报告21个elements（元素），独立OOXML逐段/样式回读确认实际20段、1218汉字，与完整作者计划精确相同，原文件名、小数和末段完整。模型按规范字节保存项目文件后明确报告“尚未完成最终交付”，最终消息 `msg_g0Vc7R71f00QjcHV0DDb` 正常stop，不能把源文件写入称作最终交付。
- 直接触发为 `work_artifact_validate` 的 `prt_g0Vc7QuMO00i7GnnJ0DG`：`validate` 结构检查已通过，后续 `view issues` 返回count6，六条全部type1/severity2、原路径/上下文齐全；共享 `assertZeroWorkArtifactRuntimeIssueCount` 只看count必须0，在渲染前抛错，所以没有PNG/PDF/最终收据/新发布卡。已保留真实失败工具、原生页面和独立源读回；不是认证、模型目录、业务金额或调度故障。
- 正式运行锁固定OfficeCLI v1.0.158及源码commit `2900a4a20f49d6a94384d6ea7fb8cc0120999825`。查阅[上游Word issue文档](https://github.com/iOfficeAI/OfficeCLI/wiki/command-view-word)，并读取同一固定commit的[DocumentIssue定义](https://github.com/iOfficeAI/OfficeCLI/blob/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Core/DocumentIssue.cs)及[Word生产者](https://github.com/iOfficeAI/OfficeCLI/blob/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Handlers/Word/WordHandler.View.cs)：severity0=Error（错误）、1=Warning（警告）、2=Info（信息）。本次中西文标点提示明确为Info，不能从英文message或C前缀选择例外。Word检查在含中文的run里匹配西文句点等，合法 `sales.csv` 与十进制金额即触发；文案只能做线索，正式severity才是分类合同。
- 控制流根因是结构校验结果与编辑审阅诊断共用“count必须零”的断言，抹掉上游已明确的severity。旧批次DOCX示例只有中文和整数，没有文件扩展名/金额小数，因此通过不能排除合法常见正文被阻断；原XLSX行高/下载/工具显示和PDF身份修复均不涉及此分类。六条信息仍应原样呈现给模型审阅，不改变文件名、金额、原文或审阅要求。
- 全仓确认共享断言的全部调用：`office-document.ts` 的DOCX/XLSX validate及issue inspection；`presentation.ts` 的PPTX两处；`script/check-work-artifact-profile.ts` 的正式包资格两处；`task-workspace-authority.test.ts` 的修复证据测试。所有生产Work及授权专家团入口使用同一工具/验证器，`prepareOfficeDeliverable` 和PPTX最终交付均重验同一函数，不增加入口旁路。上游Word/Excel/PowerPoint issue生产者共用DocumentIssue和统一FormatIssues输出，因此按severity修复共享检查，而不是DOCX特判。
- 确定方案：结构`validate`继续使用唯一零错误计数断言；独立的共享issue-report检查解析原count及完整issues数组、要求count和长度一致且severity严格属于0/1/2。只有空报告或全部Info报告可返回原完整诊断；Error、Warning、未知/缺失severity和不完整计数都保留原有有界原始证据错误。所有三种格式的生产和正式包资格调用一并切换issue检查，删除旧的issue检查调用；不增加关键词/文件名匹配、可配置放行、后备运行器或隐藏/删改提示。工具已有 `issues` 原始输出承载全部信息，无新消息或第二结果通道。
- 公共API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）、工具输入/结果字段、收据格式、持久化、规范附件和源文件均保持；最终交付仍完整重验/重渲染，消息和错误历史保留。`04-extensions.md` 更新唯一Office合同，07-panel无新界面行为，无需重复修改。没有发现调度/恢复/队列/终态异常，不改变执行机制。
- 非UI正向测试先用旧共享检查复现Info真实报告被错误抛出，再实现共享分类并验证原Info完整输出、空报告、Error/Warning明确错误响应，以及未知/缺失severity/不完整计数的明确错误合同。现有修复证据测试缺少真实severity，按当前上游合同修正，不保留旧畸形夹具。正式DOCX资格样例增加文件名和小数的真实段落，原生生命周期检查完整五段，以真实Office/runtime渲染验证，不用局部夹具冒充端到端。触及原生生命周期测试中的receipt摘要格式断言不证明真实身份，应删除；保留实际源/交付身份与工具/收据链核对。
- 风险：误把Warning当Info、漏改PPTX/包资格调用、丢失模型可见提示、畸形报告通过、实际预览长文分页仍有独立缺陷。先聚焦分类正向测试及三格式正式原生生命周期，再新候选恢复同一真实Work会话，以既有规范源继续自然校验/看图/交付；本人逐页/下载核对。原7997字节项目DOCX保持，不能绕过create-only写入保护或强制重生成以避开旧错误。run13原进程句柄59883已正常join退出0、按本人停止标记结清后才改代码；凭据/目录副本由正常收尾退役。

## 实施与验收结果

- 已按共享分析实现：结构校验保留零计数断言，三个格式和正式包资格的issue报告改用唯一 `assertWorkArtifactRuntimeIssues`；完整解析计数、数组和明确severity，只允许空/纯Info报告继续。原始报告仍完整进入原工具结果，Error/Warning/畸形报告保留有界原始错误证据。没有模型流程门、关键词例外、格式特判或隐藏消息。正式DOCX资格样例增加真实文件名和小数段落，原生测试检查完整五段；删除无身份依据的receipt摘要外形断言。
- 正向测试先在旧检查器复现Info误阻断：1项失败（`issue-red.log`）；改后整个聚焦文件12项/13断言通过（`issue-green.log`）。真实固定OfficeCLI的DOCX和XLSX原生生命周期2项/8断言通过，PPTX生产工具生命周期1项/1断言通过；它们实际生成、读取、校验、渲染和按收据发布，见 `native-lifecycle.log`。后端类型检查通过。没有新增、修改或运行界面自动化测试。
- run14从同一历史会话正常追加继续请求，沿用同一7997字节规范源，模型自然完成校验、接受两张真实多模态PNG、读取PDF、检查源及项目文件、最终交付；未重新生成/重写/替换该DOCX。最终产物 `art_g0Vc7Tc090066od6LQPJ`，交付工具 `prt_g0Vc7TXzu00cSWweCx6f`，完成消息 `msg_g0Vc7Tc3N00I2AEfWCyf` 正常stop。新成功校验 `prt_g0Vc7TB3e00Jb500AJPQ` 的全部六条Info与原失败报告逐字段精确相同，见 `retained-information-report.json`；不能把报告保留误称为零问题。
- 独立checker读取真实规范DOCX7997字节、最终PDF149493字节、最终原收据及两张渲染，按实际Tool Part关联核对已发布卡、20段/1218汉字、全部业务事实、原项目字节和两份实际浏览器下载。两页渲染与模型原校验所见PNG逐字节相同；原初及失败阶段210条数据库事实、七份原项目文件和已保存DOCX均精确保留。`run14-delivery-check.json` 为已通过的真实读取结果，不用模型自述替代。
- PDF文本初检显示等长1538字符中的三处Unicode字形码点不同：长的两个位置提取为CJK RADICAL C-SIMPLIFIED LONG，齐的一处提取为CJK RADICAL C-SIMPLIFIED EVEN。本人查看两张实际图片和原生两页确认文字完整；按[Unicode 17正式等价汉字数据](https://www.unicode.org/Public/17.0.0/ucd/EquivalentUnifiedIdeograph.txt)的通用映射结合NFKC（Normalization Form Compatibility Composition，兼容规范化组合）/空白规范化后，全部20段顺序和整篇覆盖精确匹配。检查器采用完整正式映射，不硬编码业务词或忽略缺字；这是视觉等价正文覆盖，不能声称PDF码点与DOCX逐字完全相同。原DOCX的OOXML正文始终与完整作者计划精确相同。
- 本人在真实开发服务 `/ui/` 查看原阻断画面、继续请求和新交付卡，展开/收起，逐页翻阅和100%/50%/75%缩放，核对来源、金额、全文与末段、PDF实际文件名以及原件/PDF两个下载项；中英文切换保留第2页/75%，文件原名和中文业务正文保持。全部截图已亲自查看，随后恢复简体中文并收起。一次原生输入反馈超时后读取实际菜单，确认动作已经执行，没有盲目重放或重启浏览器。
- 本批总29次真实Sol请求：run13的13次业务+2次预检，run14的12次业务+2次预检，均精确模型、流式、HTTP（Hypertext Transfer Protocol，超文本传输协议）200、源读取结清EOF（End Of File，读取结束）；Office工具初次失败保持。两个自有运行原句柄均join退出0，59583/50665端口关闭，成对auth/models副本已实际退役。没有新UI源码改动，实际前端仍为上批已验收 `main-CVNY9DPX.js` / `main-C5u2oDiB.css`，不为纯后端修复重复构建前端。

## 命令、后续线索与提交边界

- 聚焦正向测试：`bun run --cwd packages/opencorvus test test/work-artifact/task-workspace-authority.test.ts`。正式原生检查：向本批自有固定Office宿主设置 `OPENCORVUS_WORK_ARTIFACT_PACKAGE_ROOT` 后运行 `bun run --cwd packages/opencorvus test test/work-artifact/office-native-lifecycle.test.ts test/work-artifact/packaged-lifecycle.test.ts`；它们只证明实际文件生命周期，不能冒充真实模型和桌面验收。类型：`bun run --cwd packages/opencorvus typecheck`。收尾运行当前 `bun run docs:check`、`bun run check:architecture-index` 和范围差异检查，正常推送hook继续执行仓库必需检查。
- 本批仓外检查器为 `%TEMP%/opencorvus-iteration-20261127-sales-document/check-delivery.py`，实际在run14服务在线时运行 `python -X utf8 <路径> run14` 通过；服务现已正常关闭。真实Office/收据/规范附件和本人视觉证据见[产物目录](../../artifacts/2026-11-27-sales-document-delivery/README.md)。归档脚本复用时发生本地转义/状态码替换和错误字段读取错误，已按实际脚本及canonical failure字段修正并重跑通过，未改动产品事实或降低HTTP200检查。
- 后续明确视觉线索：第一页底部只有“五、谨慎业务解读”标题，其正文在第二页；正文没有缺失或裁切，但标题与首段未同页，排版仍可改进。当前尚未证明作者keep-next属性或OfficeCLI分页哪个环节负责，本批不猜根因、不修改旧不可变源来隐藏现象。下一批以原图和原始段落合同继续调查并修复，不能宣称本稿分页质量全部完成。
- 当前交付限Info误阻断根因修复、原Word正文/源文件/预览与下载完整性；没有原生Microsoft Word像素一致性、模板/表格/旧文件编辑、多端或任意输入验收。没有调度机制异常、数据库迁移、版本/发布或无关清理。提交范围为七个产品/测试/当前架构文件、本记录、真实产物及三索引各一链接；原177条无关状态保留，最终执行普通获取/合并/完整待推审查与正常推送。
