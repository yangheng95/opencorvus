# 常用操作名称与执行阅读（880）

## Recall

用户要求单 agent（代理）持续自主发现并修复整个 UI（User Interface，用户界面）/UX（User Experience，用户体验）的困惑点，真实页面体验后提交推送；不再追逐已经解决的闪烁，不操作用户正在使用的窗口。本轮最近指令“你自己刷新登录”已在874由原登录 owner 正常刷新并配对验证认证/完整模型目录；此轮不再次刷新或改变认证权限。持续 Goal 保持 active，不委托。

当前源为已推送 b87c5b64505b83a636dcb88c4ad32e362eb5e161，以及879-final已正常闭合合格的数据：schema9、92表、258669行、100项目、229附件、累计1260次模型请求。完整闭合原句柄56422 exit0。工作区177项无关视频/产物删除、索引与未跟踪运行缓存保留，只有真实不安全冲突才等待。

验收：真实已有 Mission801、Task801及可正常选中的成员历史中，常用操作使用符合实际工具含义的当前语言名称；展开仍能查看真实工具ID、参数和结果，Sources的身份、顺序、原文与所属操作完整保留。中英文真实页面截图人工复核，完整数据/项目文件/Git/附件资格与正常原生闭合通过。未出现的工具只声明代码覆盖，不能用合成记录或源码断言冒充实页。禁止任何UI自动化测试。

已读：AGENTS.md；879目标长文本表单Recall与完成证据；875/878的共享工具显示目录与来源合同；当前07-panel工具显示合同；utils/tool及CardParts、InlineToolPart、CardHeader、dialog、subagent-presentation调用链；routine-tools、tool-id-catalog、platform-artifact-tool-ids、panel/action-ids、orchestrator/decision-tool-names、orchestrator/tools、read-context-tool，以及artifact-catalog、publish-interactive-artifact、todo、mission-state、send-mailbox-message、request-orchestrator-decision真实声明/输入输出。workspace-location确认Mission必须使用真实sessionKind/目录，Task只使用taskID。

全仓定义/调用搜索确认：显示名称/图标的唯一owner是utils/tool的TOOL_PRESENTATIONS；上述五类显示面都复用describeToolPart/displayToolLabel，不需要另建字典或后端工具路由。canonical工具ID来自实际Core、编排器与panel叶子声明；这是显示契约，不改变模型可见工具、权限或调用协议。当前双语产品保留Mission实体名，本轮不另造一套翻译。

## 修改前根因与影响分析

- 现象：875已建立通用显示目录，878纠正Goal ID词序和目录读取类型，但实际平台工作记录仍大面积显示artifact_select、dispatch_agents、panel_query_task等技术标识。879-final只读真实tool_part_request统计：artifact_select74、artifact_read37、artifact_search23、panel_query_task20、panel_read_task_artifact19、dispatch_agents13、publish_interactive_artifact13；不是根据标题或最后错误猜测。
- 直接触发：displayToolLabel按规范化后的精确ID查目录，遗漏的当前常用工具正常返回原始ID；同一遗漏通过共享owner传播到主执行记录和成员侧栏。旧修复只覆盖文件/网页/Goal，未覆盖实际Task、Mission、产物与协调通用能力。
- 根因：目录覆盖不完整，且登记项手写拼接后的规范化ID，易把真实声明词序写错。改为登记实际ID，由同一个toolNameKey在Map构建和查询时统一规范化；保留既有别名识别和未知扩展身份，不建立第二ID事实源。
- 语义：artifact_select记录语义来源，不代表文件快照或调度；artifact_publish保存当前Task的不可变工作产物，不表示公开发布互联网；publish_interactive_artifact保存会话交互作品。todo同时支持read/write，现名“更新待办”不足以描述读取，应改“管理待办”。Mission state包含读/提交，使用“管理Mission状态”；调度/结束本轮等名称只解释真实工具，不把已返回的工具等同于整个工作完成。
- 范围：只扩展现有UI名称/图标目录、en-US/zh-CN相同字段及07-panel合同；raw name、解析、作者标题、参数、结果、错误、状态、Sources和身份不变。图标使用现有IconName。常用编排、产物、子任务及Mission检查/完成/阻塞/继续入口覆盖；高级专业工具与未知扩展继续保留真实ID，不扩展为全工具发现工程。
- 风险：名称误述写入/发布/任务完成；长中文名称挤占内容；主与成员显示不一致；来源归属误导。必须在实际历史的紧凑/展开操作、中英文、来源预览与成员选择中截图复核。真实记录没有的项明确标记未实页覆盖。
- 不适用：数据库schema/持久格式、Provider/模型请求协议、Task/Mission/Session调度、队列、唤醒、恢复、并发、重试、终态和权限均不改。只读页面若发现真正运行异常，立即按AGENTS共享机制横向审计；不能凭历史状态作运行根因结论。此轮不发布版本、Release、tag或PR。

## 首次资源与实施方案

before/after首次各0个Provider请求，共用首次prepare前声明75分钟绝对截止，预留5分钟正常闭合；不提高额度、不重启已有阶段、不延长截止。复制879-final完整合格隔离数据库及附件命名空间，保护全部100项目业务文件/Git；原认证和完整模型目录配对复制与退休，内容不入日志/spec/提交。before复用879实际构建main-CkimZRe3.js和原成功回执；after用Node.js真实构建。只启动项目CLI开发模式/ui/，后台本人独立页面，端口38577/38578，不碰用户18571。

1. 真实before打开已有Mission801与Task801/成员，截图技术名和来源现状；不发送消息、恢复工作或提交决定。正常关闭页面、public shutdown、原native句柄exit0、物理/输出/请求结清、配对副本退休和全数据资格。
2. 以已读真实声明扩展单一目录，登记实际工具ID并在Map构建规范化；相同双语键进入现有i18n字典。同步07-panel当前公共合同，保留作者/技术/文件身份。
3. Node构建、类型、现有语言/样式/docs检查只作辅助；after同一实际历史复核紧凑/展开/成员、中文与英文、Sources预览和原始ID。禁止新增/运行UI源码、DOM（Document Object Model，文档对象模型）、组件、快照或像素断言，也不制造模型消息测试标签。
4. 正常闭合原句柄，完整旧行/源DB/全部项目文件与Git/附件/原认证及模型目录保护核验。三索引同步，仅本轮字段与文件进入范围清晰提交；fresh fetch和普通merge、完整待推送集合复核、正常hook/push及随后fresh同步。

## 实施与实页证据

修改前真实38577页面确认：Mission801的管理状态、交互交付保存、任务完成，Task801的产物来源选取、调度消息、任务管理，以及base-tester成员侧栏的产物保存均显示原始技术ID。01原图展开Mission状态，原始Input仍标明mission_state；02成员侧栏的5操作组展开时，artifact_publish仍为技术标题、读取的operator-note.txt和其Sources完整可见。两张均已人工查看，未执行历史指令。

before关闭本人页面后，public shutdown200，原native句柄39218 exit0，出生身份物理/输出/请求结清，2份配对副本退休，实际0模型请求/累计1260。完整只读资格258669→258671行，仅一对正常控制租约新增；全部旧业务行、100项目业务文件和Git、229附件及来源DB、原认证与完整模型目录保留，零文件系统豁免。

按方案扩展单一目录：28个双语新键、既有todo名称改为管理；dispatch_agent复用分派工作，dispatch_agents区分团队分派。登记实际声明ID，由toolNameKey同时负责登记和查询规范化，旧别名的规范化匹配保留。07-panel同步合同。补读panel/capability真实叶子说明确认query_task/create_task适用于全部项目显示面，名称使用“查看任务/创建任务/继续任务”，避免将侧聊所查看的普通项目任务也误称为子任务。只修改显示意义，不改任何后端工具定义。

检索到的tool-path、recorded-tool-comparison、i18n-loading/catalog-contract均是路径、传输或资源解析正向数据契约，没有DOM/组件/快照或实际产品文案断言；未运行它们，不将其当UI验收。构建和真实后测结果随后按回执补记。

## 最终真实页面验收与保护

Node最终构建main-Od53X_nA.js，原构建句柄22151 exit0；Overlay类型检查exit0，双语2744项、现有样式token和352规格/26架构文档检查exit0。一次私有最终构建调用的PowerShell引号拼接失败，构建入口文件当时尚未生成；保留exit1回执，改为落盘脚本后重跑原构建exit0，没有绕过检查或把调用故障当作产品通过。

38578本人后台真实页面以同一Mission801、Task801及base-tester原记录验收：

- Mission主记录使用Manage Mission state/Find specialist capabilities/View tasks/Create task/Complete Mission/Save interactive deliverable等名称；切换简体中文后显示“管理 Mission 状态”“查找专业能力”“查看任务”“创建任务”“完成 Mission”“保存交互交付物”。真实作者标题、工具返回标题/字段及模型中文原文保留，名称不代替状态。05/06/07原图实际人工查看。
- Task四操作组与成员侧栏通过同一owner显示“选取产物来源”“读取成员消息”“保存工作产物”“协调工作调度”“管理任务”。展开操作仍有输入·artifact_search/artifact_read/artifact_select/artifact_publish/read_agent_message等真实标题。09/11/12实际窄成员面板中名称完整可辨，输入/输出及原生嵌套展开保留；不是另造一份消息。
- 实际点击成员operator-note.txt来源，在应用内文件面板读到原文OPERATOR_WORKING_801（10）；原5操作组逐次读取的四个文件Sources分别保留。没有以改名重排、合并或重写来源。
- 真实点击复制artifact_publish输入后，原生Ctrl+V粘贴到主输入，实际8113字符JSON、6个原始字段、schema_version1、artifact_type为base/test-report、15个source_read_refs均可读（13）。随后正常清空草稿，Send回到禁用，未发送消息或重新运行工作。工具返回的Copied提示之外，以真实粘贴确认复制成功；CUA（Computer Use Automation，计算机交互工具）的clipboard.readText当时仍返回上一轮本人695字符24行草稿，不能把该适配器读值当作产品复制失败，实际原生粘贴已排除产品路径故障。
- 14主记录实际展开artifact_read输入，Read work artifact名称、reads数组和结果结构均保留。首次role点击未得到6操作组展开视口；03仍在结尾，04上滚抵达原用户请求，保留但不作为展开通过。改用当前AX（Accessibility Tree，无障碍树）暴露的原生Expand动作后，05/06是实际目标区域。11的全文是原位展开，并非新系统窗口或弹窗。

14张原始JPEG均由本人实际呈现并人工查看，见[证据](../../artifacts/2026-11-02-routine-operation-reading/README.md)。没有新增、修改或运行UI自动化/源码文案/DOM/组件/快照/像素断言，没有制造工具消息验收标签。28个新键由单一目录覆盖；没有现存实页样本的todo、取消/答复协调、成员批量分派、任务恢复/阻塞等项目，不宣称逐项实页通过。

after正常关闭本人页面，public shutdown200，原native句柄40203 exit0；出生身份物理/输出/请求结清，2份配对副本退休。两阶段合计实际0模型请求，累计1260；258669→258671→258673行，每阶段只增加一对正常控制租约记录。两次完整资格均确认schema9/92表、全部旧业务行、100项目业务文件/Git、229附件、各来源数据库以及原认证与完整模型目录保留，零文件系统豁免；after闭合时距原绝对截止仍余3845124毫秒。没有对真实用户数据库执行构建、迁移或UI验收，没有恢复/唤醒历史工作。

继续排查线索：14中原工具结构化查看器将单数显示为“1 fields/1 items”，11/12中窄栏字段名artifact_type会在尾部换行。它们来自现有ToolPayload通用呈现，尚未在本轮更改；下一独立范围先分析定义与所有调用、再以真实原记录修复，不能据此扩大本轮已验证结论。

本轮没有后端、持久格式、调度、权限、模型或版本发布改动。范围清晰提交、fresh同步/普通合并和正常push及随后fresh复核以原始句柄与Git回执为准，持续Goal保持active。
