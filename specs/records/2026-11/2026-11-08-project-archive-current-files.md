# 项目归档与 Git 索引中的删除项

## Recall

用户要求持续按批并行体验 UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能和缺陷，先根因/影响分析落盘，再真实桌面 /ui、截图人工复核、聚焦正向功能测试，范围提交、上游合并和正常推送后继续，直到明确停止。上批 00f563238 已正常推送，main/upstream 0/0、暂存空、原 177 条工作区更改保持。b16 通知错误分支尚未获得实页证据，未改产品，不把开放调查带成已完成。Sol 授权仍待回答，本批零模型，不读取/复制/使用凭据或伪造消息。

functional/ui 两既有代理并行只读审计，无再次委托/编辑/浏览器操作。已读 task-project-archive 全部单一写入链、Task/Mission 两公开路由和执行证据投影、gitSourcePaths/index/祖先校验/物理 walker、既有 staging 与 Engine Git 的缺失条目处理、Filesystem.readArrayBuffer；两份真实源选择/归档测试、当前 git-source-entry-enumeration 架构、10 月 14 日选择/计数决策、10 月 29 日行操作反馈，以及 WorkLedger 下载入口、project-archive 客户端与 Mission 手动草稿路由。全仓定义/调用搜索确认两个 subject 共用一个 buildProjectArchive/addProjectFile；源枚举有多种消费者，不能全局删掉索引删除项。

ui_audit 校正：项目 ZIP（压缩归档）入口只在浏览器宿主的 Task/Mission 工作列表行 More 菜单，普通 Chat/TaskDirBar 无该入口。10 月 29 日已交付失败弹窗/原诊断/稳定行焦点，不重开“失败无反馈”。成功忙态/结果体验未实测，不凭 native disabled 推断缺陷，不混入本次数据功能修复。

## 修改前根因与影响分析

候选可观察现象：自有 Git 项目跟踪 keep.txt/removed.txt，创建未启动的 Mission 草稿；只删除本批 removed.txt，当前索引仍保留该路径，项目下载可能整体 500。实际尚未运行，不直接认定 ENOENT 为已复现。先保留完整对照下载/真实错误及服务原因，再决定实施。

直接数据流：gitSourceIndexEntries 按当前索引返回路径/模式/对象/stage，gitSourcePaths 合并 tracked 与 Git ignore（忽略规则）允许的物理条目，并特意保留工作区已删除的索引路径；现正向测试明确期待 removed.txt。ancestor 与目录替换扫描已把 ENOENT/ENOTDIR 视为缺失条目，stageGitSourceEntries/Engine Git 各自处理删除。这个共享选择合同服务状态、暂存、检查点与源快照，不能为归档而改成只返回当前存在路径。

Archive 消费者按 runtime filter（运行产物过滤）选择后，addProjectFile 对每个 candidate 直接 lstat→仅普通文件→readArrayBuffer→zip.add；缺失 lstat 未归类，会令整个归档抛错。Task/Mission 路由只把非 Git 的 ProjectArchiveUnsupportedProjectError 映射 422，其余真实异常沿原 500 诊断；客户端原 ApiError 保留 method/path/status/request ID/body，经既有行操作弹窗展示。权限/模型错误若发生在此前置阶段，不得误称已触达 ZIP 写入。

历史未根治原因：10 月 14 日统一物理选择、链接边界和实际导出计数；现 archive 测试验证普通文件/链接与 count，却没有普通 tracked deletion 组合。当前架构已明确“选择与 runtime filter 共用、只导出普通文件、manifest/返回值由单一 writer 计数”，因此缺失 candidate 的投影应在归档消费者处理，而非改变 Git 索引事实或增加另一份文件列表。

条件最小方案：若实际成立，仅原 addProjectFile 的源 IO（Input/Output，输入输出）范围对精确 errno（系统错误码）ENOENT/ENOTDIR 返回既有 false，普通文件真正读入后才 zip.add/计数。lstat 和 read 之间文件也可能自然消失，因此两个源读取步骤共用此有限分类；zip.add 保持在该捕获范围外，不能把压缩/依赖故障误当源文件删除。其它真实读取错误原样抛出；不解析自然语言、不 broad catch、不 fallback（后备路径）到旧字节/索引 blob，不补占位文件。原链接/目录规则、source producer、文件名、schema（结构）和执行证据保持。

共享影响：Task/Mission 两生产下载入口同一个 writer，fileCount 仍只在真实 zip.add 完成后增加，manifest/header 同源。未改变 Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、恢复/执行轮次或串并行控制；当前没有该类异常运行事实，若真实出现则立即完整共享横审。无 API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）响应形状、数据库/持久格式、权限、模型提示或前端产品改动。

## 条件验收方案

系统临时根 opencorvus-iteration-20261108-b17，新 project-before/after 和 profile-before/after；开发 serve /ui before 38952、after 38953。两个 Git 仓库仅为本人测试输入，不是规避交付仓库脏状态/钩子的分支或 worktree（工作树）。使用本批私有空/公开 Git 配置，隔离系统/global Git 用户配置和签名凭据；主仓库 Git 环境、钩子、分支不改。原文由 authored-files.json 声明，包括存活/待删除/未跟踪/忽略文件，不读取用户项目。

前态：从真实页面 Mission 的 Save a draft 建立未启动草稿，填本人标题/请求、选择当前实际可见的兼容 Squad（专家团），不 Start、不调用模型；无可见兼容项或 runtime 前置未就绪时如实记录，不伪造模型目录/行/消息。手动草稿公开路由明确无模型调用。先真实浏览器下载完整对照 ZIP，再仅用文件系统删除本人被跟踪文件；同 Mission/同菜单重试，保存实际错误弹窗/请求 ID、原日志对应 syscall/path 与索引/物理事实。

实证成立后先补记录，再加聚焦正向真实 Git/ZIP 测试：Task builder 输出存活文件准确原文、完整 source 路径集合、manifest 的 Task 身份和实际 count，覆盖叶文件删除、父目录删除/替换后仍有的普通文件；保留原 gitSourcePaths 删除项正向合同。先验证新测试确实触发旧错误，再最小修复并跑原真实 checker（检查器）。新测试不用“不包含/不调用”为核心断言，不用 mock（模拟）代替实际文件/Git/ZIP。

after 全新 profile/项目/未启动 Mission，重复真实下载；标准 Python zipfile 独立检查实际浏览器文件里的存活源 bytes（字节）、manifest/文件计数与真实 Mission 身份，界面中英及失败→再试焦点按实际截图记录，不改无证 UI。Task 生产 builder 的真实文件/归档测试与 Mission 公开实页分别留证，不把局部 fixture（夹具）称全流程。必要时用本人精确存活源文件的短期独占读锁形成真实其它 IO 错误，释放后同入口成功，证明未吞掉其它异常；helper（辅助进程）必须 finally 释放、明确原句柄/正常退出，不碰用户进程。

前端源若保持不变，复用当前普通构建 main-BydIgfm3.js 并记录实际服务来源；后端 source 由新的开发进程加载。聚焦后端类型、真实功能测试、docs:check/architecture-index，截图人工复核，不新增/运行任何 UI/DOM（Document Object Model，文档对象模型）/组件/浏览器 fixture/快照/像素测试，不用摘要校验代替真实对象字节。模型预算零，Sol 授权未答不使用凭据。

结束关闭本人页面/服务与锁、原启动句柄 exit 0，下载精确移出本人返回的 Downloads 路径。原 177 条工作区更改保留；精确三索引、范围提交、fetch/普通 merge upstream、完整待推集合审查、正常钩子 push 后继续。所有真实未测/前置阻塞明确列出，不以单一 subject 通过扩称全部入口端到端。

## 修改前实证与实施决定

2026-11-08 本人隐藏 IAB 36、开发后端 38952、main-BydIgfm3.js。真实手动 Mission 草稿 bfa710789ee305e8 保持 Draft/Backlog，无 Start。完整对照浏览器文件 4474 bytes、6 源文件、5 执行投影文件；Python zipfile 独立逐一核对当前物理源 bytes，keep/removed/Unicode notes 与 authored 输入一致。启动运行时按既有政策写入 .gitattributes、.opencorvus/opencorvus.jsonc、更新 .gitignore，均按当前真实源处理，未把原 authored .gitignore 当运行后期望值。

仅删除本人 project-before/removed.txt，Git ls-files 仍含该项，真实 status 为 D removed.txt。相同项目行 More→Download Mission project 返回 HTTP GET 500，请求 256e7daf-c36d-4527-8031-b753b0a9c2bf。既有错误弹窗/Details 正确呈现请求原诊断；服务相同 ID 的 error.code=ENOENT/syscall=lstat/path=该 removed.txt，stack 精确落到 addProjectFile:111→buildProjectArchive:252→mission route:347。完整对照排除 Git/项目/Mission 前置未就绪，准许按条件最小方案实施。

完整对照下载完成后稳定 DOM activeElement=BODY，列为下一批独立体验候选，本批不改前端，不把成功焦点描述为合格。原失败弹窗的 OK 可用，截图 04 人工查看原 ID/正文完整可滚动。

## 实施与验收结果

产品仅改 task-project-archive.addProjectFile：源 lstat/read 精确缺失码返回既有 false，普通 bytes 入内存后在 catch 外执行 zip.add。其它 errno 原样抛出，成功计数仍由既有单一 writer 增加。当前源枚举架构补充 archive 缺失投影语义，producer/staging/checkpoint/公开响应均未改。

先跑新三项正向回归：3 fail/6 assertions，均旧 lstat ENOENT，checker 确认进程/输出已结算。修复后原真实 checker `bun run test test/git-source-consumers.test.ts test/git-source-paths.test.ts`：6+5 pass/34+20 assertions，包含原 cyclic 多项目选择/真实 Task ZIP/检查点字节及源索引删除项合同。后端 typecheck exit 0；docs:check 352 ops/26 groups、architecture-index 20 docs 通过。前端无代码修改，复用并实际观察 main-BydIgfm3.js；不增加/运行 UI 自动化。

新 profile/自有 Git 项目，真实 Mission 草稿 59b8100dd9fc89e0；在首次下载前删除 tracked removed.txt。浏览器实际 ZIP 4225 bytes，五个当前源文件逐一与磁盘 bytes 相等（含中文目录名和保留正文）；manifest schema/missionID/count 准确。独立实际公开路由 GET 200，x-opencorvus-archive-file-count=5、Content-Length 等于实际 body4224 bytes，请求 26d08f3b-4aac-45da-85b8-f0a7b9abd7e5；不同请求导出时间/压缩元数据可变，不比较整个 ZIP 摘要。

对本人 keep.txt 短期独占读取锁，中文实页同菜单返回 HTTP500，请求 a9a925fb-c22b-49fb-9e0d-efc1a13951f5；对应服务 code=EBUSY/syscall=open/path=keep.txt，证明其它源读取错误仍被真实 checker 路径呈现。helper finally 正常 Dispose/exit0；点击确定返回本人 Mission 主按钮，随后同中文入口真实 ZIP4225 bytes成功，独立读取五源原文与 manifest 身份/count一致。原错误弹窗正文/控件中文、Details 为真实技术诊断；截图05—08人工查看。此验证不是模型任务执行验收。

资源：IAB36/37已关闭，两个本人 serve均经POST/shutdown原exec句柄exit0，exclusive lock原句柄exit0。精确三个浏览器下载移入本人临时 exports；公开HTTP ZIP也只在该临时目录。仓库只保留声明、选定原请求诊断/独立内容回执和8张真实截图，不提交 ZIP/完整私有日志/凭据。

### 明确未验与后续

Task 通过生产 builder 的真实 Git/ZIP局部路径，Mission通过真实页面/公开路由；未把前者称 Task实页端到端。lstat后read前自然消失的时序未人为制造，Windows父目录替换在本机返回ENOENT，ENOTDIR分支按同一文件系统合同处理而未真实触发。Sol授权仍未答，零模型，b04/b16开放范围不受本批冒领。项目ZIP成功后稳定BODY焦点确有实证，单独进入下一批分析，当前前端焦点未修复。
