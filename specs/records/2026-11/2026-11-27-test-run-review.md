# 真实聚焦测试执行与结果回看

## Recall

- 用户要求本人持续批次调查UI/UX（User Interface/User Experience，用户界面与使用体验）、功能和缺陷，分析落盘后才修复，真实桌面交互与截图人工复核、聚焦正向测试、必要精确openai/gpt-6.1-sol流式端到端、范围提交/最新上游普通合并/正常推送，直到明确停止。现凭据与完整模型目录配对授权、请求不限；不用子代理，不建额外聊天/分支/工作树，不运行UI自动化，不刷新或泄漏凭据、不发布/tag（标签）。
- 上批51eb598a8d942da79afefd7744535fce4683e00f已交付具名笔记本通道标签，原push4412明确join退出0、实际远端/本地/上游一致0/0、暂存空，177原状态保留。run96/97原26776/85860已退出0/四次预检EOF（End Of File，流结束）/配对副本退役，两自有页关闭。当前Git事实重新核对相同；前轮为真实产品交付进展，无阻塞。
- 新批仓外test-run-review从退出run97准备23原文件/2326旧行（398消息/1187部分/354请求/354结果/33产物），原sample Git f7bf091156c9b137c4eb3d5b822721294e9a8f24。保留181字节sales.csv、7650字节sales_summary.py、10107字节test_sales_summary.py及既有pyc；不改旧来源来凑测试。
- 已读原test_sales_summary.py的setUp/cleanup、fixture和两个目标用例：test_actual_csv调用当前真实sales.csv并核对5/35.60与华东3/28.25、华南2/7.35；test_refund_and_zero用测试临时目录的两条明确输入核对2/-12.30。两者均为正向完整输出断言，不执行其余用例或CLI（Command Line Interface，命令行接口）写文件路径；Python使用-B，临时目录由原标准测试清理，不更改项目/pyc。
- 已读InlineToolPart的真实state/input/output/metadata（元数据）及可读Shell输出、ToolPayload的原文/结构化展开与阅读状态、现Shell多行源码修复、工具失败摘要记录。当前命令摘要/退出码/原输出契约已有实现，不凭源码命名或旧记录预设新缺陷；开始时Windows rg通配路径失败，已改为rg自身文件筛选/实际已列出的文件路径，不把工具检索错误当产品问题。
- 真实Work（通用工作）是sessionKind=conversation&experience=work，不能再猜sessionKind=work。由可见项目首页保留“通用 · 对话”直接提交即可，不切多步任务，不创建Task/Mission（任务/多步任务）或分派。保留原自然模型/工具消息，主验收由本人操作；computer-use与benchmark-debug-template技能沿用。

## 初始真实任务及验收方案

1. 启动自有run98继承已退出run97，开发模式/ui/，分别核验凭据可用、精确模型已投影及实际Sol流式模型。沿现180秒真实字节无活动与独立服务生命周期，轮询不续期，不因观测超时重启。
2. 从可见project首页启动单人通用Work：实际读取test_sales_summary.py和需要的源码，实际运行Python -B -X utf8 -m unittest -v指定两个完整方法名。不要改文件/pyc、不要创建产物或提交示例项目，测试自身的原TemporaryDirectory除外；任务仅需真实命令、退出码、每项结果和口径简报。不把临时退款用例的2笔/-12.30当作真实sales.csv事实，不宣称全套通过。
3. 本人实际查看运行/完成、展开命令与完整工具结果、读回原来源、回看自然消息；按需要复制真实记录/语言主题/键盘与截图核对。后台实际持久化和公共API（Application Programming Interface，应用程序接口）核对原命令、工作目录、退出码、测试数和实际输出；只用实际证据判定，不以模型自述或标题替代。
4. 若有缺陷，先完成现象/触发/数据或控制流根因/旧路径缺口、全部定义/调用/同语义/历史、公共合同/数据/测试/文档/交付/风险分析，再修改单一根因，回到同一真实路径复验。若首任务正常，继续实际回看和独立调查，不编造缺陷或只以记录结束改进批次。
5. 所有UI验收仅原生页面操作/截图人工复核，不新增/修改/运行UI、DOM（Document Object Model，文档对象模型）/组件/文案/快照/像素自动化；非UI改动才增加聚焦正向合同测试。调度/队列/唤醒/恢复/并发/终态异常立即横审全部生产入口、Task/Mission/Session执行轮次、重试重启、串并行和多项目，不降为单例偶发。
6. 完成后保护23文件/2326旧行及SQLite/样本Git，排空并join原服务、退休成对副本、关闭自有页。证据及三个索引/声明文档检查同步，范围提交、fresh fetch/普通merge/完整待推集合审查/正常push且join/实际远端核验，然后继续。

## 已完成调查与根因/影响分析（实施前）

- 真实Work为ses_hXxKTLlM9wO3oKV8NYjc。自然read两次后Bash prt_g0VcBHSae00ee6YrdPLm（msg_g0VcBHRqE00jxtc8lZCW）实际执行原指定命令；公共Part API读取completed、metadata.exit=0、两项完整测试名各ok、Ran 2 tests in 0.012s与OK，最终自然消息finish=stop。工具输入workdir为真实project绝对路径，模型正文正确区分真实5/35.60和临时2/-12.30。23原文件、2326旧行、样本Git、SQLite integrity_check均通过。未发现调度/恢复/并发/终态异常，不触发共享执行机制异常横审。
- 可观察问题：本人展开2次操作和Bash工具，实际命令、退出0及两项原输出直接可读，但指定工作目录完全不在命令阅读区。必须展开原始输入，才看见JSON中的workdir。已分别查看并保存完成、命令输出、来源摘录对话框与原始输入截图；动作后第一帧曾仍为旧界面，第二次保留目标画面才作为对应证据，不把旧帧当产品故障。该问题是可核对性不足，不是工具跑错目录或测试失败。
- 直接触发与数据流：Bash schema的可选workdir在执行时经resolveWorkdir归一化为实际cwd，未指定时取Instance.directory；实际Tool Part.state.input完整保留所传字符串。InlineToolPart已经从同一Part读input，但visibleShellCommand仅消费toolInputCommand，原input ToolPayload默认collapsed；命令正文因此只投影command。Card和CardParts的全部详细工具展示均调用该唯一InlineToolPart，主/侧聊/成员回看不另有命令目录展示。ToolPayload完整原输入复制和展开有效，无需修改。
- 旧路径缺口：11月23日Shell源码修复解决脚本传输/退出回执，当前命令展示保留原command，11月27日失败摘要解决错误说明；两者没有把显式workdir投影到命令上下文。本批不扩成执行协议、cwd解析、默认目录推断或command输入解析修改。会话shell-exec和其他shellcommand/runcommand未声明相同Bash workdir契约，不能按名字添加cwd/directory别名。
- 已全仓搜索定义/调用/同语义：toolInputCommand三个消费位置、SHELL_TOOLS及InlineToolPart全部引用；Bash workdir schema/resolveWorkdir/ProcessSupervisor cwd；当前07-panel工具回执和复制身份合同、messages.css命令样式、两语言当前工具标签。无现有指定目录标签或平行投影需要保留。检索中两个错误目录（src/locales、session/shell.ts）已通过rg --files纠正为src/i18n和session/shell-exec.ts；不归为产品问题。未进入或运行UI自动化测试。
- 范围与公共合同：只为Bash详细命令区显示同一已保存输入的显式、非空字符串workdir，标签为“指定工作目录”/“Specified working directory”。保留字符串原貌、换行和路径分隔符，明确它是所传参数，不声称相对路径已解析的实际cwd；不以当前选中目录/metadata/猜测补齐缺失值，不增加别名/后备路径。原输入、命令、退出码、输出、复制、原Part身份/状态、权限、工具声明/模型请求、Provider、传输/持久格式及默认cwd均不改变。不涉及数据库迁移、配置、版本或发布。
- 实施决定：在InlineToolPart现有命令块旁用语义dl/dt/dd投影显式参数，现主题token与mono字体、长路径自动折行；英中标签和07-panel唯一合同同步。纯UI展示不新增自动化测试或非UI数据函数；类型/构建/i18n/CSS检查仅为辅助，核心验收是新候选真实页面中的同一Part、输入/输出原文复制、来源回看、中英文/深浅主题和截图人工复核。风险是长Windows路径挤压命令区与把请求参数误称实际目录，分别由折行布局与明确“指定”命名处理。未指定或非Bash的视觉分支尚无实际截图，最终如未覆盖将明确列为限制。


## 实施与验收结果

- 唯一InlineToolPart现从同一Bash已保存input投影显式非空workdir，在命令前显示本地化语义定义列表；原字符串保留、monospace和主题token、长路径可折行。没有新增执行/状态/后备来源、接口或持久字段。两语言各1键、13行局部样式、当前架构同步；纯UI改动未新增/修改/运行UI自动化或无关非UI单元测试。
- 精确Sol通过真实页面完成新Work，实际读取两个原文件并运行指定两项测试，原命令/目录、exit0、两项ok、Ran 2 tests in 0.012s/OK由公共Part API和原保存记录核对。本人页面回看自然最终结论，正确区分真实CSV五笔35.60与临时退款零值两笔-12.30。候选重启后完整三个Tool Part逐值等于基线，未重跑或合成任务；独立Decimal复核真实CSV地域汇总。
- 四张before与九张accepted原始JPEG本人查看。新包在原命令区直接显示完整指定目录、命令、退出与测试输出，原文视图保留完整bash_metadata，展开动作正常；英语深色和恢复中文跟随系统仍显示同一目录/输出/展开操作。真实来源文件工作台Ctrl+F/键盘输入/Return定位第61行退款用例，随后滚动读到原完整2/-12.30断言，并核对相邻真实5/35.60断言；未保存编辑。
- 新页135在首次产品Copy前静默初始化reader，没有工具paste。原输出首次Copy/Copied读回318字节与Part.output逐字节相同，真实Ctrl+V为文本框正常CRLF转LF后的311字节；原输入首次Copy包含command/description/workdir完整原值369字节，真实Ctrl+V逐字节相同。两未发送草稿已清空。原输入JSON对象键序与API展示序不同，仅对象序列化顺序，不把它当数据丢失；同一复制文本和粘贴完全相同。
- 类型60472、构建87883原句柄均join退出0，构建52.48秒及公开面通过；双语3367键/CSS9446引用2文档、docs353操作26组/架构20文档通过。23文件和2326旧行完整保全、SQLite检查ok及sample Git保持；自然新增本轮记录允许，不回写历史。run98 PID30164/57083原59104和run99 PID20044/56618原23692都明确join退出0，共九次精确Sol流式HTTP200/settled/EOF，配对凭据和完整模型目录预检通过、请求排空、成对副本退役；两自有tab关闭。
- 观察纠正：动作后曾截到旧帧或较上方的源码，正式证据只纳入实际目标画面；右Dock拖动仅达到现380上限，未证明更窄路径折行，未将该截图作为通过。当前真实范围为已完成Bash的显式绝对Windows目录；相对/空/未指定参数、其他shell工具、运行/失败、新窄宽折行、其他主题/屏幕阅读器未新验，不声称全套Python测试或CLI通过。提交/最新上游普通合并/正常推送精确事实写仓外交付回执，持续目标继续。

- 提交前实际比较发现Git将独立native-copy-output.txt的CRLF按仓库属性归一为LF（318变311字节）；已将四份实际clipboard捕获按原字节打包native-copies.zip，并直接比较暂存ZIP各成员与仓外原捕获，318/311/369/369完整相等。独立文本明确为归一化阅读副本，不把它当原始字节证据；没有改仓库换行属性或重算摘要充当验收。
