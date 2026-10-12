# 347 连续文件来源的重复目录

## Recall

用户要求持续自主体验/修复/改进，主要问题是Sources显示与子侧栏Rendering闪烁，最新只用单agent。本轮不委托、不创建产品Task成员。346修复已推送c63b5f862，真实24条来源暴露重复长目录：一个文件每个命中行下都有同样的3行路径，正文被压到很后面。前轮是progress。当前HEAD为另一个发布任务的6c7f2f74e（0.1.24准备），开始工作区干净，尊重其交付范围，不代做发布。

## 已读、根因与影响

已读346 Recall/截图02、09/实际Source来源，320长路径设计及两个同名文件验收，07-panel/07-panel-reactivity，SourceParts的label/detail/fileCaption/Tooltip/open/copy与Key分组、CardParts连续引用组、sources CSS，search_code到fileSource真实生产器及公开path/title/range/sourceId契约。全仓检索SourceChip/SourceEntry/sourceFileCaption调用，均在共享SourceParts内部；主会话、Side chat、child共用。

320已删掉每行主标题和次行重复的filename/range，但独立SourceEntry仍对同一文件的连续命中逐条重复完整目录。这是本轮多行密度问题的直接显示根因，Source身份、实际路径和行号均正确，不能删除Source、改计数或把不同目录同名文件并成一项。新的clipboard memo已由346实测，本轮不重复改它。无新的后台调度/恢复异常，若发现则按共享机制横审，不能从页面标题推断。

## 实施方案

只在同一实际相邻Source组中，当前和前一条均为普通source-file、完整path字符串相同且现有sourceFileCaption结果相同时，省去当前行重复的次级说明。首条仍保留完整目录；换文件、不同完整path、attachment或不同caption均显示原说明。自定义title使caption承担真实文件名/范围时，遵循原函数结果，不能仅按basename或共同目录抑制。逐条标题、range、顺序、sourceId、完整Tooltip/可访问名称、打开与复制动作都用原Source。没有新状态、缓存、协议、数据迁移或文件路径裁剪。SourceChip/Entry接收单一显示标志，Key身份和展开状态不变。纯UI改动不新增UI自动测试。

## 真实验证与交付

346的Side Session在原runtime内生成了匿名项目目录，完整历史复制要额外区分启动项目和Session目录，不能篡改原目录来满足旧helper。本轮不改历史复制合同；直接使用新的真实普通会话，获得同时包含重复文件和同名不同路径的真实Source组。

先按当前0.1.24源码构建基线，再启动独立source-context-347-live-01、18324/ui，沿已验证NativeService/private官方Bun1.4.0，固定600000ms、16次累计Provider请求。原授权OpenAI auth与完整models成对，预检分别usable/projected/实际gpt-6.1-sol流式。创建普通输入：两个不同目录中的同名中文Markdown文件，甲24条、乙2条SHARED347记录。一个真实Side chat只实际search_code这两份输入并简短说明，不写文件、不委托、不建Task；来源必须自然经生产工具生成。

真实页面先展开26条来源并截图人工查看，确认重复路径与不同路径边界，再实施与build。仍只操作自己的页面，在原预算内reload同一已完成会话、展开同一组，人工核对目录只在正确边界显示、来源数和行号保持、复制完整位置与两文件打开行号。若原窗口不足正常结算后新独立实例，不能扩时；若失败保留具体证据。

禁止UI自动化测试、DOM/源码文案/截图断言；overlay typecheck/build/docs不能替代截图。保留完整实际模型与工具结果、前后截图，关闭自己页面和服务，原启动handle实际join、Native/Host/output/request/配对清理以及自有native文件按出生归档。根/月/目录索引同步，精确提交、fresh fetch/merge、检查全待推送集合并正常push。保持goal active，普通Side样本不冒充子Dock全帧Rendering验收。

## 工具链与细化边界

基线构建60521实际exit0，main-Cm-evkKa.js。另一发布任务随后把工作区版本改为0.1.25，改变了原生helper的现有构建缓存位置。01 Host在spawn-admission明确失败：隔离HOME中的rustup无默认工具链，尚未产生Target或模型预检。原exec已exit1、Host出生身份已死、端口空闲、auth/models均未移交；普通输入文件创建保留，不把缺失预检当通过。原因是私有启动器此前依赖已有helper缓存，而非生产调度异常。

读取生产process-supervisor解析器和已有prepare-test-process-supervisor脚本，确认两者使用同一实际helper路径。通过原脚本在隔离开始前解析已安装cargo/rustc，独立CARGO_HOME/TEMP构建当前helper；22139实际exit0，12.60s，不改变全局Rust默认设置。新私有wrapper每次先走这一当前准备器，再调用原NativeService launcher；不替换生产process facade或扩大预算。02为新独立轮次，预检usable/projected/gpt-6.1-sol/streaming后才复制相同26条人工输入，再重跑原页面验收。

显示条件细化为只共享目录caption。原sourceFileCaption已区分attachment标记、自定义title所需的完整location、普通directory；将该单一派生结果返回kind/text，避免另写标题判断。仅当前/前一条均为directory kind、完整path相同且caption文本相同时省去当前次行。自定义title即使位置文本恰好相同也继续保留其完整location说明。

## 最终验证

真实页面136中同一search_code生成26来源；基线截图01确认每行重复长目录，after03/04/08确认相同文件更紧凑且换到另一同名文件保留目录。真实Space复制甲文件:20、Return打开甲第20行和鼠标打开乙第2行分别通过，05/06实际高亮对应甲记录19和乙记录01。来源组返回后仍展开且25 more sources计数准确。8张截图均人工查看，无UI自动测试；附件/custom-title/POSIX未另做真实视觉验收。

类型11125、after构建54594实际exit0，main-DbppdFkA.js确由服务返回200。02原启动15764正常shutdown后实际join0，6次gpt-6.1-sol均流式200/EOF，Native577726ms、全部物理/输出/请求和配对退休闭合。原工具链失败01完整保留，不计成成功运行。实际数据库26来源、24/2行号范围、两文件完整输入字节、复制值均核对；89份原始监督文本压缩归档，50份含压缩内容凭据扫描0。docs通过345 ops/25 groups。当前另一任务89ec8c2ad已在upstream；本轮仅交付自己的SourceParts、架构与spec。
