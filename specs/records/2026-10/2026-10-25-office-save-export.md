# Office 附件保存、源文件下载与PDF版式

## Recall

用户要求持续自主体验并修复当前产品的界面/功能，单agent，不再排查已关闭的Rendering闪烁；真实页面与必要真实Sol验证后提交、同步上游并正常推送，仅实际冲突无法安全取舍时等待。上批b8fc13ba3已推main且0/0，DOCX/XLSX生成、原生158保存、中文下载名和列宽已验证。597原Chat两次正式deliver完成，两个源实际下载/原生读回和PDF/PNG人工复核；指定交付目录未保存、卡片只下载PDF、XLSX A3留白仍未完成。原594连接失败具体根因仍未知，不以新功能成功冒充修复。历史真实请求83次完整保留，全部自有服务公开关闭并结清、auth/models副本退休。用户18571和用户数据库不操作，Goal保持active。

开始HEAD b8fc13ba3，工作区有并行CI测试修改、旧产物删除和三个共享索引排序，均保留；CI会话声明正处理14个明确后端测试，当前不触及其范围。已读597 Recall/结果、当前02-data、04-extensions、07-panel、17-code-work-agent-platform及benchmark-debug-template；全仓搜索WriteTool/ToolFiles/文件权限、File.copy/upload、AttachmentStore verified snapshot、Artifact schema/reader/publisher/export、Tool completion和display关联、SDK及原生测试。无子agent，无新branch/worktree。

## 修改前根因与影响面

1. 原模型明确报告无法二进制另存，代码证实唯一write参数是filePath/content字符串；File.copy已有项目内部操作但未作为此模型可用接口，直接调用host File.copy还会绕开Task ToolFiles权属。不能用Bash Office写入或人工脚本复制冒充模型完成。扩展现有write接受与content互斥的attachmentUrl，读取当前Project唯一canonical verified bytes，以现有executionFiles和路径检查写入新目标。仅附件分支以exclusive create保护既有文件和悬挂链接，并用既有FileConflictError报告冲突；文本分支保持当前读后覆写合同。共同沿用文件事件和FileTime。无第二写入工具、Office专用保存路径或新权限。
2. 卡片下载只由payload.source导出；file-preview的source正确指向PDF，editable源只存在同一次真实Tool完成事实的attachments及sourceSha。改payload会制造无必要的持久数据演进。现行Session.persistCompletedToolResult在一个事务内提交完成Tool与带toolPartID的display Part，故可从Artifact的精确message/display/toolPartID关联读取真实完成事实，按其已声明sourceSha选择原canonical附件，作为ArtifactRecord的可选downloads只读投影。三种Office profile共用；不改已有payload/消息/receipt，不迁移或重写数据库，无持久影子字段。Project/Session归属先由原reader校验；存在声明却缺匹配源时应明确损坏错误，不猜路径或替代文件。API/SDK声明与前端同一次更新；旧真实交付卡自动获得原文件下载。
3. XLSX PNG已按内容裁剪，PDF仍固定A3横向，与小表实际尺寸无关，导致大量纸张空白。PDF由同一renderer按每个已验证worksheet真实边界生成独立命名页面尺寸与固定纸边，覆盖多表的不同宽高及最后一页；Word继续A4。来源、真实列宽、外部资源阻断、页数/尺寸/字节/时间限额与receipt身份保持。只改预览，不改Excel源内容；需实际多表PDF结构/页面尺寸合同和真实页面人工复核。

涉及定义/消费者包括WriteTool与description、ToolFiles host/capsule、AttachmentStore、FileTime/编辑事件、ArtifactRecord及同步find reader、Session Tool事实和display关联、API生成器/SDK、InteractiveArtifactPart/ArtifactFrame及FilePreview/Presentation导出、office-html-render及原生acceptance。现有SQL schema8、持久payload格式和调度语义不变；没有发现队列/唤醒/终态异常。风险为跨项目读取、Task路径边界、覆写/并发冲突、历史display缺关联、下载身份失真和打印页边界；不能用模型自述或DOM文本证明成功。

## 实施及验收方案

1. 在原实现完成三个修复，复用公共primitive；不改旧迁移。write新增正向真实字节/事件/明确冲突与跨项目错误合同，验证当前文本行为；Task分支走现有真实ToolFiles权属检查，不增加host旁路。发现本范围过期UI自动化测试时删除、不运行。
2. 后端Artifact reader测试真实持久display/tool关联、冷HTTP读取及Project/Session隔离，验证原源下载与PDF预览并存、损坏声明明确错误；不构造生产消息。无关联的普通Artifact仍按其实际内容返回，不推断源文件。
3. 原生DOCX/XLSX生命周期和编译包检查覆盖真实Office内容、receipt与交付；PDF断言针对原生PDF页数/尺寸合同，不做UI渲染、快照或像素差测试。UI只手动页面交互、截图与人工复核，检查旧卡与新卡菜单、真实源下载、PDF单表/多表可读和保存后的项目文件。
4. 新scope598基于已关闭597完整自有数据/附件，原Chat/源文件/全部失败保留；普通Node构建更新UI并由开发CLI /ui服务，不单独开Vite。最多32次真实流式Sol请求（全部预检/后台计入），历史83次保留，累计上限115，不因观察超时重启/重置/扩额。凭据与完整models成对准备，任务前独立验证可用凭据、目标投影、实际gpt-6.1-sol。原生20分钟物理边界，至少提前五分钟公开关闭并结清原调用/native/launcher/输出/请求，再退休副本。
5. 原Chat自然请求将两份已生成附件保存到交付路径、更新并检查紧凑Excel预览、正式交付。以实际write参数/完成事实、磁盘精确字节/原生读回、真实卡片下载事件及PDF截图验收；不能脚本代写业务文件或写假消息。全部证据落specs/artifacts，更新三索引/架构并跑当前docs与必要检查，精确提交、fetch/merge、完整待推审查及正常hook推送。未达项保留，不把持续Goal标完成。

## 编译包验收的原生失败信息（实施前补充分析）

新的独立编译包两表检查已真实执行，create成功而batch退出1，原进程已经退出并完整结清。当前公开错误只留下命令和exit code，未留下OfficeCLI真正原因；不能根据最后错误命名猜根因。Process.RunFailedError本身保留stdout/stderr，但其message只拼stderr；OfficeCLI的JSON失败输出在stdout，默认runOfficeCli直接向上传该Error，故丢掉可用于修复的实际诊断。parseWorkArtifactRuntimeJson对success=false也只有通用说明。共享Process对其它程序的合同不变，在Office唯一依赖边界将真实退出码、stdout/stderr及原cause加入有界WorkArtifactRuntimeError，并让JSON失败沿用同一诊断类；三种Office格式和Task/普通会话统一生效。用明确失败输入到当前诊断类/完整关键信息的正向合同覆盖，再重新进入原编译包检查，获取真实原生错误并修复。无重试、writer替代、跳过原验收或关闭失败进程当通过；未发现调度/队列/终态异常。

## 已实现与真实验收

- 通用write、生产Tool完成事实关联的只读downloads投影、三格式共用下载菜单、逐工作表PDF页面和原生错误诊断均按上述方案落地。OpenAPI（开放接口描述）与JavaScript SDK（软件开发工具包）由真实生成器同步；未改变schema8、持久Artifact payload、已交付迁移或旧消息。
- 聚焦后端合同：附件写入5项、真实持久投影/冷HTTP读取3项、原有归属2项，共10项通过、20次断言；batch/错误合同4项通过、5次断言。覆盖精确字节与编辑事件、既有目标与并发目标的明确冲突、项目隔离、现有文本写入、Task原生文件权属和边界。全部为后端当前正向合同，无UI自动化测试。
- 实际编译包的双工作表完整author/validate/deliver再次执行成功，PNG（便携式网络图形）分别294×202和280×130；实际PDF（便携式文档格式）两页分别245.04×175.92和234×121.92pt，与各表内容加边界一致，保留36/25/−11、字面量001与=1+1。实际图片已人工查看，结构合同见产物目录。最初batch退出1的具体原生原因仍未知，后续成功不能证明该失败根因已修复。
- 默认生产runtime边界另外执行真实OfficeCLI158读取缺失文件，得到`WorkArtifactRuntimeError`、原始`ProcessRunFailedError` cause、exit1及stdout的`file_not_found` JSON；证明诊断丢失已修复。不是mock或以构造错误代替真实失败路径。
- 普通Node.js生产构建的前端`main-tOX5snnD.js`与编译后的当前服务在54106 `/ui`运行。单人操作自建浏览器页279，原Chat `ses_-zUQxA1lPzzUZFA4CCxZ`自然继续；真实模型gpt-6.1-sol完成两次attachment write、inspect/validate、PDF读取和正式deliver。两份Office源保留原身份，目录文件6414/4853字节均与canonical附件一致；真实浏览器下载的两份原文件和紧凑PDF也逐字节一致。原Markdown1581字节与CSV196字节内容与原模型实际apply_patch输入一致。
- Office包中DOCX正文、XLSX实际单元格以及真实下载PDF独立读回：四模块/四状态与36/25/−11完整，业务PDF一页318×175.92pt。新Excel卡片和既有Word卡片都在真实页面显示原文件优先、PDF另列，已各自点击并取得实际下载。原有全部Artifact记录精确保留；Task、root ingress、task plan事实与开始时相同，数据完整性ok、版本8。
- 实际模型期间保留两项错误及恢复：通用read本地DOCX按现有合同报告binary；第一次模型Bash嵌套PowerShell引号导致变量展开错误、exit1，模型随后修正引号并真实校验源身份。不能把这些真实错误抹掉或声称全程零错误。未发现需修改Bash公共命令合同的证据。
- 当前普通Node前端构建、后端编译、两端typecheck和真实SDK生成通过；文档检查350操作/26分组通过。生成器曾因Bun命令参数位置错误只显示帮助，该次不算生成成功，改用`bun run --cwd packages/sdk/js build`后实际完成。首次测试启动参数与临时目录问题、漏写Tool wrapper metadata字段的期望均已修正后进入原聚焦验收，不用失败工具代替交付。

## 生命周期结果与未通过项

scope598上限32请求，实际19次全部streaming200且原reader EOF（流结束），累计102次；未用13次退休。原物理20分钟边界未延长或重置。12:12:45UTC公开shutdown200，原始调用45798、native和launcher均exit0，物理进程链dead_or_reused，输出与请求清理均结清；随后仅删除自有auth/models成对副本，源凭据stat和源模型目录完整性保持。

**提前五分钟关闭的验收未通过**：实际仅剩131146ms，原retire检查真实失败并保留；在其它物理/请求/输出断言全部通过后单独完成凭据副本退休，未修改原失败检查或把时序失败改为通过。该项是本次操作未按方案及时收尾，不是生产调度器异常；不能宣称本scope全项验收通过。原生首轮batch的原因仍未知，594原连接失败也未证明修复，持续Goal保持active。

下一轮候选观察是原Chat底部“Files changed”仍只显示早先MD/CSV，磁盘已有DOCX/XLSX；它是否属于当前差异摘要的预期二进制策略仍未知，需先审计唯一快照/差异投影与实际文件事件，不能仅凭截图判为bug或直接增加影子文件状态。

用户18571进程、页面和用户数据库均未操作。该scope仅使用已关闭597的自有数据及附件。并行CI提交已独立收敛，未触及其后端测试文件；剩余无关删除和共享索引排序保留。交付记录在提交后补充正常hook与upstream同步结果。
