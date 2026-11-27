# 文件状态统一原生 Git 差异统计

## Recall

- 用户要求本人持续分批迭代，先根因/影响分析落盘、再修复、聚焦正向检查、真实桌面交互截图人工复核、需要时精确流式GPT-6.1 Sol验收、提交/最新上游普通合并/正常推送，直到明确停止。禁止子agent（代理）、新线程、额外分支或工作树；现有凭据及模型目录授权成对使用，请求不限，不刷新源凭据或记录秘密。
- 上批已交付 `0279a0bc778d56c97ff79f3b05ccd6d174cda3b6`，本地/上游/真实远端一致0/0、暂存空、原177条工作区状态完整；仓外chart-font-readability/delivery-result.json核验。原run27句柄95227已join退出0。本Recall初次落盘时run28仅调查，未改产品源码；当前检查点为本批实现、6项/76个正向断言、后端类型、真实run29接口/桌面复核均完成，run28原77906及run29原57381已join退出0；待范围提交、最新上游合并和正常推送。恢复不能重启run28/run29。
- 已读File.Info、File.status、File内容与错误合同、Vcs.diff原生统计/路径/链接/无HEAD与patch上限、Git源架构、当前07面板合同、相关消费者/测试、上批Recall；全仓搜索File.status/file.status/FileInfo及接口消费者。生产入口为GET /file/status、生成SDK（Software Development Kit，软件开发工具包）与debug file status；当前审阅UI（User Interface，用户界面）使用持久化变更记录，不消费该接口。没有相关UI自动化测试被运行或新增。
- 保留当前18个项目文件、1006条历史记录（message183/part495/request158/outcome158/artifact12）、示例项目HEAD和原全部附件。仓外file-preview-review保存真实页面调查截图、原件/历史精确副本、旧接口结果、原生Git对照、177状态基线。恢复先重读本Recall及结果，不重启同label服务。

## 现象、触发与根因

- 本人在真实开发 `/ui/` 打开资源管理器和sales.csv，编辑器正确显示中文原文；进入审阅，原PPTX记录显示新增/非文本/行数未知，不能将它误报为UI错误。随后直接进入同一开发服务真实GET /file/status：新16266字节PPTX返回added=55，旧PPTX返回52/56、XLSX25、DOCX31/32；review/图片审阅.md返回8，原生git diff --no-index --numstat为7。同一服务Vcs.diff的三份PPTX均为原生二进制统计0/0。
- File.status独立重复VCS（Version Control System，版本控制系统）差异实现：未跟踪普通文件用Filesystem.readText解码全部任意字节并split换行，因此Office/PNG/pyc压缩字节中的换行被当作文本行，尾换行又额外计1，空文件也会计1。tracked路径只用numstat并一律status=modified，导致已暂存新增被错误标为modified。删除路径另起循环更新物理状态；真实回归确认原2行删除统计仍正确，排除“删除行数已丢失”的初步怀疑。旧链接修复只共用gitSourceLinkDiffs，普通文件的分叉算法仍在；部分现存测试甚至把末尾换行多计一行固定为期望值。
- 当前Vcs.diff已通过真实Git --name-status/--numstat、实际链接blob比较、完整有限源枚举处理相同物理事实，并支持无HEAD、嵌套仓库、中文/字面路径、多项目上下文及原始错误。继续增加文件扩展名黑名单或文本启发式将形成第三套判断，不能修复共享事实来源。

## 影响、公共契约与排除

- 统一File.status到当前Vcs.diff统计投影；保留Info现有path/added/removed/status四字段、非Git返回空列表及Windows本地分隔符/字典排序。二进制沿用该公开数字合同的原生0/0表示，不能把0宣称为可计算的文本行数；UI历史仍使用现有nullable（可空）行数事实。无数据库或持久格式变化，无API（Application Programming Interface，应用程序接口）/SDK结构生成变化。
- 为状态读取跳过不需要的patch正文，在现有内部DiffOptions增加可选patch=false，仅控制同一原生差异路径的patch生成；默认调用保持完整现有diff行为。不是新增端点、第二事实源、模型流程gate（门）或配置面。移除File.status独立HEAD/numstat/文本解码/删除/链接投影和仅为其服务的导入；hostGit在File.read仍使用，保留。
- 相关测试：git-source-consumers、server/file-read-identity、server/file-save-conflict中的旧多计1期望必须更新。其他链接/文件错误合同保留。调度、队列、恢复、并发或终态没有异常证据，不改其机制；多项目并行文件读取属于本批正向覆盖。
- 风险：Vcs导入须保持项目身份读取不要求Provider/模型；补测冷启动不可用模型的真实文件路由。内部patch选项不得使普通Vcs.diff变成无正文输出；补测同项目完整patch与状态输出。原有源枚举错误仍由真实路由checker验证。文件状态只读过程应保留用户索引和文件字节。
- 初次类型检查发现VcsFileDiff公开结构允许历史status缺省，但当前diffFiles生产者每条都从DiffItem写入明确status。为保留公开结构，仅收窄该真实生产函数链的TypeScript返回类型，表达已有事实；不补默认modified、不改公开schema（结构）或历史记录。

## 实施与验收方案

1. 先写真实Git正向回归：含已暂存新增、未跟踪单行/空/二进制、已修改/已删除文件，核对明确status/统计；对照当前Vcs.diff完整patch，覆盖并行项目和原始索引字节。先运行看到真实错误。
2. 删除File.status重复实现，使用当前Vcs.diff的原生统计投影，内部patch=false跳过正文。更新上述旧测试期望，当前Git源架构说明统计单源，不更改UI实现。
3. 跑聚焦真实非UI测试、相关冷路由/真实文件保存测试、后端类型、文档/架构检查；不运行全量bun test或UI自动化。真实开发服务改动前后必须正常退役并join原句柄，使用新label重启当前源码，不复用旧服务冒充新实现。
4. 新真实服务核对原18文件/1006行历史、同一真实文件状态与Vcs.diff数字/物理状态一致；本人再打开文件/审阅截图确认源文件、中文名及非文本记录仍可用。本批没有模型行为变化，不需要另造业务模型任务；成对预检请求照实记录。
5. 更新根/相关README；脏索引仅暂存各自一条链接。范围提交，fresh fetch（取最新远端）及普通merge（合并），检查全部待推提交，正常钩子/push（推送），核对远端/暂存空/原177状态。无版本/Release（发布页）/tag（标签）变更。

## 执行结果

- 调查与方案已先落盘。新真实Git回归先按预期失败：二进制3而非0、空文件1而非0、末尾换行2而非1、staged新增误标modified；修改/删除的真实统计正确。随后删除File.status约100行独立投影，统一当前Vcs.diff原生事实；普通文件统计跳过不需要的patch正文，默认diff保留原patch。同步修正3处旧测试中的尾换行期望。
- 聚焦6项真实正向检查共76个断言通过：新并行双项目物理状态/文本/空/二进制/普通完整patch/精确索引保留；原循环链接并行项目消费者；不可用模型的冷启动文件路由；真实HTTP多进程/重启/保存冲突；原真实indexed linked-ancestor命名错误/响应schema；真实链接修改与删除。后端类型通过；没有全量测试或UI自动化。初次类型检查暴露可选公开status与当前必写生产事实的类型差异，已用内部精确返回类型修正，再重跑原检查通过。
- 旧服务run28正常退役后，以当前源码独立启动run29端口65409。真实GET /file/status与同服务Vcs.diff统计和物理状态完整相同；13条状态中的6份Office文件为原生0/0，review/图片审阅.md为7行。现有文件内容接口保留Markdown原混合换行；检查器首次误用Python read_text将换行规范化造成自有断言失败，已改为原字节解码并重跑原检查成功，未改变产品内容合同。新中文PPTX仍为16266字节只读binary（非文本），原18文件/1006持久记录/示例项目HEAD和读取前后Git索引字节一致。
- 本人在新服务真实Chrome `/ui/` 再开资源管理器/sales.csv，逐页检查源中文记录；进入审阅选择“清晰图表”历史记录，确认中文名、非文本/行数未知及原始版本下载可见，再通过“阅读当前文件”进入真实文件工作台，看到同名路径/只读/16,266字节。三张新截图均亲自查看，旧调查两张截图也保留。UI合同原先即正确，本批不将接口修复包装成UI文本行数修复。
- run28/run29各2次成对凭据/目录预检，共4次精确Sol流式200/源reader完成，业务模型请求0；本批无模型行为变更，没有另造模型业务任务。原句柄77906/57381均join退出0，成对副本退役，63962/65409端口关闭。原生源码与脱敏统计、检查器、日志和截图见[本批证据](../../artifacts/2026-11-27-file-status-native-diff/README.md)。文档与架构索引检查通过；无发布/标签/版本变动。
