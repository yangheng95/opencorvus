# 项目文件点段引用的单一身份

## Recall

用户要求持续按批次并行体验和调查当前版本，先根因/影响分析并落盘，再修复、真实桌面交互/截图人工复核、聚焦正向功能测试、必要的授权 GPT-6.1 Sol 流式端到端验收，范围提交、上游同步、正常推送，再自主继续；未要求停止。不得新增/运行 UI（User Interface，用户界面）自动化测试，不创建额外分支或工作树，保留其它任务修改及暂存区。

已完成模型名称搜索 b3f5c6ad3、完整字节文本准入 5768f3b35、模型键盘前缀导航 8976ae281，均正常推送。已重读最后一批 Recall；最后一批 spec 的“剩余提交”是当时快照，实际交付已完成。当前其它任务维护 Sources 并发、网页抓取、PDF 阅读器及用量周期，均排除本批。

只读委托 file_alias_audit 与 file_alias_contracts（一层，禁止再次委托）：前者核对全部引用/工作台导航/移动删除入口，后者验证真实隔离 Git、HTTP（Hypertext Transfer Protocol，超文本传输协议）内容与权限合同。主 agent 核对源码和日志，负责真实页面与视觉复核。已读 AGENTS、07-panel 文件阅读/身份合同、file-text-admission 与 model-keyboard 记录、server-path、tool.relativePathFrom、project-directory、file-workbench、File.read/writeText 及相关正向测试。全仓搜索 normalizeProjectFilePath、relativePathFrom、projectDirectoryKey、File.read 调用及历史 310/311/374 路径决策；无触及的 UI 自动化测试。已有独立纯路径基线 22 项通过。

## 现象、直接触发和数据流根因

文件服务先以服务器 path.join 归约引用，再 realpath 做权限与读取，内容修订号/写锁以规范物理路径与完整字节为依据。因此 README.md、./README.md、folder/../README.md、missing/../README.md 指向同一文件，即使中间 missing 不存在。前端 normalizeProjectFilePath 只转换 Windows 分隔符并丢空段，留下点段；工作台以 directory/path/sourceAbsolutePath 严格比较身份，别名进入离开草稿流程；编辑器同样把原路径当重载身份。真实页面表现仍待复现，不提前宣称。

absolute 引用使用未归约的 relativePathFrom 前缀：项目内部点段可被错误归为外部只读，跨边界的绝对点段又可被错误归为项目编辑。移动/删除的 descendantSuffix 使用同一旧函数，选中别名时可能跳过当前文件离开决策。这是同一公共路径事实问题，不能仅修 Markdown 点击。

后端 File.read 内容和 revision 正确，但 Git diff/show 继续使用原始 file。隔离真实 HTTP 60550 实测：folder/../README.md 与 missing/../README.md 返回同内容与 revision，Git show HEAD:<raw> 却 exit0 输出提交信息及 diff，structuredPatch 将其14行当原文件；真实已提交基线只有2行。Unicode/前导空白文件同样复现。hostGit 明确 nothrow，未检查 show 结果还会让不存在的 HEAD blob 使用空基线。调查原证据在独立 scratch backend-alias-evidence.json/run-2.log，后续归档。纯 git 命令不能替代此真实服务证据。

旧 310/311/374 只覆盖根/大小写、分隔符/文件名、absolute 与 relative 普通身份，未验证点段、升出再返回、根夹持和 Git object 语法。因此仅前端修正会掩盖原始 API 缺陷。

## 影响面、边界和风险

覆盖普通正文/Sources/Explorer 文件打开、编辑 reveal、草稿导航、移动删除的同文件 admission（准入）与 receipt（结果回执），tool/file-change-summary 路径展示，以及真实 File.read Git 差异。读写权限、revision 和锁已按物理路径正确，保留现有实现。附件与明确项目外 absolute 来源保留原始只读目标；路径归约不猜符号链接/硬链接身份，不折叠文件名大小写，不修剪文件名空白，POSIX（Portable Operating System Interface，可移植操作系统接口）反斜杠保留。Windows/UNC（Universal Naming Convention，通用命名约定）根按服务器语法夹持点段；前导真正越界的 .. 保留并走现行权限错误合同。

当前 projectDirectoryKey 已有点段归约，但自身 trim/反斜杠/小写是项目目录身份策略，不可直接用于文件。抽取其词法 primitive（基础组件），保留原目录策略，让文件路径及绝对归属复用同一归约。不新增配置或后备实现。前端只证明词法同一文件；symlink/file 与 target/file 不凭空合并。后端 Git 路径应源于实际词法 full 与现有 Git 工作树的相对关系，保持权限先验；不扩大父仓库发现或改变 sandbox。Git 返回值与正当新增文件的空基线须明确处理，不能猜测错误为新增。

无 Task/Mission/Session 执行轮次、调度/恢复异常证据；本问题在文件身份/阅读器数据流，不改变引擎。UI 只改路径数据，不增控件或文案；现有双语控件保持。不得运行浏览器/DOM（Document Object Model，文档对象模型）测试。

## 实施与验收方案

1. 主 agent 准备独立当前源码开发服务 /ui 与私有正式 UI 构建。复用已审阅 NativeService 真实 Provider 运行器，唯一新运行根、固定600秒和12请求预算，启动前绑定 auth.json 与完整 models.json，验证凭据可用、模型已投影、实际请求 gpt-6.1-sol 且流式。使用真实普通会话读取本人创建的文件并输出不同拼写的 Markdown 引用，保留自然消息/工具结果；前态点击同一文件别名复现多余离开提示。只有独立拥有的服务/页面可操作。
2. 后端与前端限定文件并行实现（禁止再次委托），先保存/审查各自原差异。共享路径 primitive 处理 .、..、升出再返回、根夹持，relativePathFrom 对归约后的绝对位置分类；文件名字符与原目录合同保真。File.read Git path 从已解析 full 得出，使用精确文件 pathspec、精确 blob 基线与明确错误/新增契约。
3. 聚焦正向纯路径/工作台服务测试断言规范目标、range/reveal、草稿决策顺序与移动回执；真实 Git 项目的 API 测试断言内容、相同修订号、hunks/oldLines、Unicode与空白文件。先复现再验证修复，不新增以“不调用/不存在”为核心的断言。这些是数据/服务合同，不是 UI 自动化。
4. 后态私有构建与新的独立运行重复真实会话引用点击：未保存草稿在全部同文件拼写间保留，行列 reveal 正确；保存后检查真实磁盘字节与重读。绝对外部点段仍只读，内部归约后可编辑。需要的真实移动决策通过桌面/服务合同分别明确证据边界。截图逐张人工查看。Provider 运行正常 shutdown、物理退出、输出 drain、成对凭据清理；原失败日志保留。
5. 类型检查、正式构建、docs:check、architecture-index、diff check 与独立复核。更新本 spec、07-panel 当前合同、根/月/artifacts索引。私有 Git index 隔离本批提交并保留其它暂存内容；fresh fetch/merge、完整 upstream..HEAD 审查、必要验证及正常 push；下一批继续。

## 当前证据和进度

已完成影响分析、前后端实施、聚焦正向测试、独立复核及最终真实桌面/Sol验收；下文保留原始中间失败与修复事实。范围提交、上游同步和推送仍待收尾；持续目标保持 active。

## 后端实施记录（file_alias_contracts）

File/index.ts 实施前 diff 为空，已保存 scratch/file-index-before.diff；只修改该文件与新增 file-git-alias-contract.test.ts，不暂存/提交。已有 Vcs/EngineGit 的 HEAD 判定只返回 rev-parse 失败布尔或具体内部 repository 合同，不能直接区别 initial 与损坏；不把它作为新增文件事实。依据 [Git status v2 官方协议](https://git-scm.com/docs/git-status#_porcelain_format_version_2)、[literal pathspec](https://git-scm.com/docs/git#Documentation/git.txt---literal-pathspecs) 和 [ls-tree 输出协议](https://git-scm.com/docs/git-ls-tree)，由同次机器可读状态取得 exact HEAD 与该路径 staged/unstaged 事实，逐个 NUL（Null character，空字符）记录解析 metadata/path，rename 消费其 original-path 第二记录。branch.oid 只接受明确 `(initial)` 或完整 object identity；文件名的空白、Unicode 与换行不能注入状态头。

Git 路径由已词法解析 full 相对 Instance.worktree 得出，仅转换宿主分隔符；保留原引用作为 patch 文件标签。Instance.worktree 来自当前 sandbox，不切换主 Project.worktree；无 local .git 的子目录仍不发现父仓库。所有过程继续由 hostGit 持有，status 关闭 optional locks；literal 路径查询当前 commit 的 tree，再按返回 object identity 读取确切 blob。仅明确 initial 或成功 tree 查询证明该 exact path 新增时使用空基线；任何 Git 非零、损坏协议或未知 HEAD mode/type 都进入现行 Error/HTTP500 UnknownError 合同，不把失败当空文本。原 diff/show 路径同步删除，无后备路径。

使用授权 Bun 1.4.0 绝对路径及其 PATH 运行新增真实临时 Git/TCP API（Application Programming Interface，应用程序接口）合同。修复前 5 项中 3 失败、2 通过：dot alias 得错误14行基线；bracket 名字被 glob 匹配脏 sibling 后错误生成空 patch；损坏 index 仍返回200。新增/initial、rename 旧行为通过，保持其正当空基线合同。scratch/backend-contract-before.log 保存完整复现。后态首次验证运行中；真实页面与总体交付由主 agent 完成，未提前宣称验收完成。

后态曾因自定义 ls-tree format 对 Unicode/special path 转义而误判新增，真实 API 测试已定位；采用现有 snapshot 同款默认 `ls-tree -z` 原始 metadata/TAB/path/NUL 协议修复。新增6项49断言及既有37项文件回归通过，package typecheck通过。精确单文件 status 查询在真实 rename 后输出 type1 AM，不是 type2；完整原始状态已保存在 backend-contract-regression.log，测试名同步纠正。type2 双记录消费只经源码复核，未宣称该精确 API 查询实际覆盖。

独立复核指出 HEAD 目录→当前 regular text file 的同链边界。真实临时 Git/API 输入证明 HEAD 为 `040000 tree`、当前状态为该路径 A. 及旧子文件 D.；初版基线修复返回500，日志 backend-directory-transition-before.log。旧身份不是文件 blob 是已验证事实，不能用 `git show` 的 tree listing 充当文本，也不应拒绝当前合法新增文件。实施补充：成功 tree 查询遇 `040000 tree` 或 `160000 commit` 时依据其明确非文件旧身份采用空文本基线；`100644/100755/120000 blob` 按实际 object 读取；其它 mode/type、无效协议或对象读取失败继续显式错误。加入实际目录转文件新增 hunk 正向合同；本地 nested Git 仓库真实 gitlink 转文件也按同一 mode/type 合同验证。符号链接既有 physical content/权限/revision 规则排除扩展。

后端最终源码稳定；最新 package typecheck exit0（backend-typecheck-final.log），scoped diff check及新增测试 Prettier check exit0。最终新增8项真实 Git/TCP API合同57断言通过（backend-contract-final-revision.log），明确验证暂存/未暂存同文件别名正确内容、String修订号与原2行 hunk；Unicode/前导空白和literal bracket文件；既有HEAD新增/initial首暂存、真实限定rename type1 AM、真实 `040000 tree` 与本地nested仓库 `160000 commit` 各自转regular file的新增hunk、HEAD blob真实删除与index真实损坏的现行500 UnknownError。此前相邻文件合同4+26+7共37项195断言通过（backend-contract-regression.log）；合计45项252断言，POSIX专属文件名案例在Windows本次运行中明确未执行，不宣称跨平台实机验证。权限/锁/符号链接physical阅读代码未修改。scope只含File/index.ts、新增后端测试及本spec后端段，未暂存/提交，其它并行修改保留。

实际最终命令均先prepend授权Bun1.4绝对路径目录到该命令环境PATH：`<bun140>/bun.exe run --cwd packages/opencorvus test test/file-git-alias-contract.test.ts`；相邻回归为同runner追加 `test/server/file-read-identity.test.ts test/file-text-admission.test.ts test/file-attachment-editability.test.ts`；类型为同runtime `run --cwd packages/opencorvus typecheck`；格式为同runtime `x prettier --check packages/opencorvus/test/file-git-alias-contract.test.ts`；`git diff --check -- packages/opencorvus/src/file/index.ts packages/opencorvus/test/file-git-alias-contract.test.ts specs/records/2026-10/2026-10-13-file-alias-identity.md`。runtime完整位置为 `.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe`，scratch日志统一 `.tmp-codex-file-alias-01a133/`。旧的format转义和目录拒读失败日志保留，未覆盖成成功。

## 主验收前态与工具链修复

18436 当前源码服务使用已固定的上一批私有正式 UI 构建。Provider 预检凭据 usable、catalog projected、actualModel gpt-6.1-sol、streaming=true；主请求服务端过载，自动原请求重试后产生真实可见 AI_StreamProviderError，未获得模型读取结果。四次实际请求都是该模型/流式/HTTP200/reader EOF；EOF 不等于模型业务成功，前态不能称完整 Sol 验收通过。

原始用户 Markdown 消息由正常 UI Send 自然产生。打开 Canonical notes.txt:2:4、Ctrl+End 输入 DRAFT ALIAS BEFORE，点击 ./notes.txt:2:4 弹出 Unsaved changes/Save before leaving（01 图人工查看），Cancel 保留当前草稿。保存本人临时文件后点击 project/../outside.txt 的绝对引用，被错归项目 ../outside.txt，呈现读取失败（02 图人工查看）；实际外部文件存在。没有注入数据库/合成模型消息，两个截图证明真实导航/分类缺陷。

首次复制独立运行器遗漏 live-sol-observe-owned.ps1，父 supervisor 在监听启动前报 CommandNotFoundException，先启动的合法 Native Target 继续正常运行；原 settlement 因无监听未能停止而记录失败。横向核对现有成熟 helper、Host/Target occurrence 与生产 owner：这是本次 scratch 依赖复制遗漏，未发现生产调度/恢复共享根因，不改产品过程机制。补齐原观察脚本及其 FunctionsOnly 入口，使用原精确 Host/Target 标识、独立 recovery 记录经正常 /shutdown 完成 exit0/output drain/request cleanup，原进程已 dead_or_reused、端口释放，auth.json/models.json 成对清理。保留首次 supervisor/settlement 失败，未重写为成功；新观察脚本对原发生实例正常返回关闭事实。后态新 occurrence 必须完整重跑验收。

前端首轮定向合同128项/258断言通过，连目录消费者139项/298断言；独立复核又实探 Windows C:/Repo + ../repo/file 的base比较case遗漏，需修正并重构建。初次私有构建exit0（2m2s）只覆盖首轮，不作为最终UI构建。Overlay类型exit0。后端真实合同另发现 ls-tree --format=%(path) 转义Unicode，改用默认 -z 的原始 filename；尚待最终聚焦验收。所有前态/中间失败保留，不据此停交付。

官方协议核对：[Git status](https://git-scm.com/docs/git-status) 的 porcelain-v2 分支身份、initial 和 NUL 路径/rename 记录，以及 [Git ls-tree](https://git-scm.com/docs/git-ls-tree) 默认 -z 原始文件名格式；采用当前稳定协议，原输入不作为对象表达式。
独立复核使用实际 Node win32/posix join→relative 的144组组合零差异；初次遗漏的Windows目录再入case已补8项前态失败，最终前端147项/312断言通过，移动回执27项重测通过。触及测试为纯数据/service，无UI自动化或负向核心断言。scoped literal rename真实输出type1 AM；type2第二记录消费只完成源码复核，不能称该真实API分支已验。

## 后态构建绑定复核（未通过的原始轮次）

18437真实Sol已完成一次read并生成自然Markdown回复，五种原始File API别名返回相同内容/revision和真实3行hunk。临时checker最初漏预期CR：实际Git attributes将HEAD存为LF、工作文件仍为CRLF，调整明确fixture预期后五项全部通过；保留真实端点结果，未改产品行尾合同。

桌面仍出现同文件离开提示，改按可见link定位再次复现，证实不是元素编号误操作。实际/ui的immutable source header与HTML声明assets/main-CAo85tzZ.js，来自packages/overlay/dist-vite；私有新build入口为main-BcMd5X5F.js。overlay-ui.ts解析ui在process.execPath同目录，而本人误放在bin的父目录；前态也使用此实际仓库旧构建。原前态真实缺陷证据有效，关于其固定私有构建的声明据此纠正。18437原稿截图只证明旧UI仍失败，不能作为修复后通过。补绑定到本人私有after-bundle/bin/ui，不修改共享dist-vite；原服务正常shutdown exit0/reader EOF/成对凭据清理。新18438新occurrence重新做全部真实验收，保留18437错误绑定事实。

## 最终真实验收

18438新的NativeService发生实例，Bun1.4与ui同置after-bundle/bin；实际/ui header/HTML声明新构建main-BcMd5X5F.js。固定600秒/12请求预算保持原约束。预检三事实均通过，主用户消息正常UI发送；真实GPT-6.1 Sol调用read notes.txt offset2/limit1，规范tool outcome completed包含Alias ORIGINAL、totalLines3，随后自然回复六个Markdown引用。实际六次Provider请求均gpt-6.1-sol、stream=true、HTTP200、source reader settled/eof，未耗尽预算；最后NativeService qualification成功。每条消息保留真实参与者，未手工改数据库或合成回复。

独立真实HTTP端点直接读取notes.txt、./notes.txt、folder/../notes.txt、missing/../notes.txt、../project/notes.txt五种输入：text与完整CRLF内容、相同物理revision、精确3行HEAD baseline hunk全部通过。该输入本人已在隔离仓库提交基线后改首行，证明后端读取确实经过脏Git路径而非仅untracked文件。

真实桌面Windows英文深色1280×720：从模型回复Canonical打开文件，在第四行输入DRAFT ALIAS FINAL；Current folder、Parent segment、Return to project、Internal absolute均保留同一notes.txt草稿和Save状态。Sources notes.txt L2也保留草稿并reveal；再点击内部绝对引用后键入LOCATED，实际插入第二行第四列，成为AliLOCATEDas ORIGINAL（截图02），证明原行列请求继续生效。Save后的71字节与明确预期完全相等，三个CRLF保留；正常Reload完成后的截图04保持保存内容。外部absolute project/../outside.txt正确显示真实外部内容和Read only（截图05），不再当项目路径报错。五张后态截图已逐张人工查看；原前态两图及错误绑定图保留。移动/删除准入和回执有正向service合同，未声称本批做了其桌面端到端。

最终后端45项/252断言，前端147项/312断言全部通过；Windows回执27项重复复核通过，未使用无目标全量测试。两个package最新类型检查exit0，最终私有正式UI构建exit0（1m22s），独立复核144组Node路径对照零差异、全部限定diff与协议/mode准入复核通过。API测试的POSIX专有名称只在对应平台条件中声明，当前Windows没有真实Linux API证据；porcelain type2只做代码复核。没有新增、修改或运行UI自动化测试。其它组件改动由各自任务维护，不混入本批。

页面已关闭，18438正常/shutdown、Target/Host exit0及完整output/request收尾，端口释放后auth.json/models.json成对清理；parent监督正常exit0。18436首次工具链失败经独立recovery关闭、18437错误UI绑定正常关闭，原始失败不改写。规范SQLite只读快照、完整已脱敏运行日志gzip、实际Provider与物理收尾回执见[证据索引](../../artifacts/2026-10-13-file-alias-identity/README.md)。当前仅剩Git范围提交/推送。
