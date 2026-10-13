# 372 CR 文件来源坐标

## Recall

用户持续要求自主改善Sources/UI/功能，最新只用单agent，不执行旧goal的Astra委托。上一轮progress：371修复换行保存，b18c0965486be81b1152b01c23bed697676b72a9已正常push，工作区clean、main与origin/main一致。16纯数据测试、16实页图、10实际Sol流式EOF、原54003/30476与两scope均闭合；371保留CR来源坐标候选，本轮从其真实文件/Source事实继续，不改写该轮验收边界。

已读371 Recall、367列换算决策、当前04-extensions文本行合同、07-panel编辑器合同，grep完整生产执行/预算/预览/Source输出，Ripgrep的JSON schema/parser/searchHost，/find路由、debug ripgrep、ReadTool/text-file、executionFiles和capsule file broker。全仓搜索parseSearchOutput/searchHost/line_number/absolute_offset、SDK消费者及实际搜索测试。Sources只有search_code将rg行号直接写入range；/find和debug明确返回rg原始协议，不构造Source，Overlay无find.text调用。它们保留原始协议，不能暗改JSON字段语义。Read/Skill与CodeMirror已按CR/LF/CRLF解释行。

## 现象、根因、影响与风险

371真实cr.txt包含4逻辑行，search_code Source却为1:10；grep直接使用result.line_number，matchOffset也从整个rg LF记录起算。纯CR一条rg记录可能包含多个编辑器行；混合文件中，当前记录之前未命中的裸CR也造成全局行号偏移。367只修正同一行UTF8字节到UTF16列，没有建立跨换行映射；371仅修复保存，不能反向修正已持久化Source。

[ripgrep searcher官方源码](https://docs.rs/grep-searcher/latest/src/grep_searcher/searcher/mod.rs.html)说明CRLF模式仍需要LF分行；安装rg14.1帮助也说明encoding转换会改变字节偏移。只加--crlf、只切当前命中行、重新运行用户正则猜位置、修改前端显示或改历史数据都不足。需保留原真实regex结果，映射到当前UTF8文件显示坐标，覆盖之前裸CR、同一rg记录多个命中行、跨CR匹配、真实零宽匹配无submatch、CRLF/LF对照、UTF8 BOM及无效UTF8既有列合同。

Task与conversation共用grep输出，必须保持同一执行权限/取消/30秒总时限/2MiB累计输出及物理结算；不新增Host文件读取旁路。候选利用同一run和同一rg在有未知前缀行时读取裸CR记录，以其真实line_number/lineBytes补齐缺失行边界事实；不会重跑用户正则。原匹配与换行事实统一投影为逻辑匹配行/跨行range，并保持既有整行脱敏再裁切规则。是否需要禁用rg自动编码转换以对应文件原UTF8展示，须实际BOM对照确认。细节和失败合同待聚焦实验后落盘，当前不修改生产。

未发现调度/队列/唤醒/恢复异常；若运行出现此类问题，按共享机制全入口/occurrence/终态/重启重试/串并行/项目隔离横审。新增读取边界不能绕过既有Task capsule，不能以无时限全文件Host读取来修正坐标。非UTF8编辑仍独立未完成，不在本轮宣称支持所有编码。

## 验收与交付

预声明source-cr-location-372-before/18376与after/18377两个独立NativeService，各600000ms、12累计请求，不扩期/重开。授权auth与完整models成对私有绑定，分别验证usable/projected/actual gpt-6.1-sol streaming。真实模型仅search_code/read生成自然Source与回复，无开发子agent或产品成员调用。自身新项目创建CR多命中、混合前缀、CRLF/LF、BOM及跨CR匹配输入；/ui实际逐个点击并人工截图，核对页内位置/真实读取行及完整canonical数据。原launcher实际join并关闭全边界后归档。

先新增实际rg/SearchCodeTool聚焦正向合同保留改前失败，再实施最终方案；补覆盖零宽/无效UTF8/匹配跨换行/既有预算取消与权限合同。不运行UI自动化；涉及路径发现此类测试即删除。类型、正式build（若UI变更）、docs和architecture检查；记录未验边界。范围commit，fresh fetch/merge并审查完整待推集合后正常push，不创建分支/worktree/tag/release，goal active。

## 改前实页与最终设计

原1088命令错误地把Bun过滤参数传给只接受文件路径的仓库runner，保留完整失败；按原仓库入口精确单文件重跑原60295，实际25pass/5fail。新增CR、mixed-prefix、UTF8-BOM、CR多命中和跨CR范围五项全部真实rg失败，不把runner参数错误当产品缺陷。before18376/page195真实依次2search+2read，搜索Sources错误CR1:11/mixed3:4/BOM1:4/cross1:8，读取Sources正确CR3/mixed5；6图人工查看，原15809及唯一shutdown均exit0，8实际Sol流式EOF、全物理与成对凭据闭合。

最终方案保留rg原JSON协议供/find/debug；只在search_code的唯一Source投影边界，将原匹配跨度转换成CR/LF/CRLF逻辑行。原搜索和补充边界扫描均使用现有run、同一executionAuthority、同一30秒deadline和2MiB累计输出。只对存在line_number>1的已匹配文件按既有参数批次查询`\r[^\n]`，其完整实际LF记录足以计数此前裸CR；EOF最后一个CR不会先于任何后续记录，因此不需EOF分支。初探`\r[^\n]|\r\z`实际会因rg的记录匹配语义返回普通CRLF行，已排除此方案并保留probe；选定单模式的真实结果只返回带内部裸CR的记录。失败/取消/预算仍进入原SearchCodeExecutionError/abort合同，补充扫描不成功就不伪造坐标。无Host读文件旁路或新Task运行器。

search_code统一使用--encoding=none以保持原文件字节，与当前read/editor的UTF8展示一致；安装rg14.1官方help已确认该选项禁用BOM剥离，实际BOM测试已证明旧坐标少1。/find/debug的显式rg协议和编码行为不改，不宣称支持UTF16编辑。原始匹配行按原byte ranges分割为逻辑行、同一逻辑行重复命中合并、相交跨行跨度合并；跨CR真实匹配返回完整start/end范围且不带单行列。没有submatch的真实零宽结果仍是该rg记录覆盖的完整行范围，不能猜测空匹配位置。预览取实际对应逻辑行，规范换行拼接，继续全片段脱敏后围绕首个实际匹配裁切；Source、输出行标签和元数据计数来自同一投影。当前历史Source不重写。

## 改后验收与边界

84653初版实际30pass；补Task/conversation前缀、真实零宽CR范围、两权限补充扫描输出超限后，94473最终35+8+11=54pass，8275类型exit0，docs/architecture通过。两个真实补充扫描超限均output_limit、保留2096038bytes（原搜索已消费共享预算），进程计数回到初始；这不是调度异常，而是明确预算合同。CR极密集前缀会触达该既有错误边界，不声称任意大小均可成功。读过inline-base64实际正则，三类payload检测均以CR/LF为token边界，逻辑行投影没有引入跨换行的payload截断机制；既有完整脱敏/裁切/无效UTF8测试均通过。

after18377/page196真实4工具+自然回复产生9Source，CR3:4/5:2、mixed5:4、BOM1:5、cross2–3实点正确，LF/CRLF3:4与read3对照、重复搜索列定位均人工复核；9改后+6改前共15图。两阶段完整文件字节保持原值。模型自然正文的path:2-3尚未被当前Markdown位置parser链接，结构化Source范围按钮正常，保留为下一轮候选；改前自然文本中的反斜杠r被视为路径的现象亦未在此加关键词补丁。

原15809/31997均实际join exit0，Native241666/271765ms，各8实际gpt-6.1-sol流式HTTP200/EOF，页面195/196、全物理/output/request/端口/auth-models对关闭，最终IAB为空。真实checker完整canonical Source/Message/ToolOutcome/文件字节/HTTP/Provider/Native通过；截图为独立人工视觉证据。后端数据变更未新增UI构建，两页面均实际加载371正式main--IPEAIl1.js。Task原生合同已验，未宣称新增OCI实测。继续完成归档、范围提交、fresh upstream合并与普通push，goal保持active。
