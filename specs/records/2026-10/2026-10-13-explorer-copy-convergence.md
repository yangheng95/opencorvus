# Explorer 批量文件操作的真实结果收敛

## Recall

用户要求持续分批并行调查当前版本，先完成根因和影响分析并落盘 specs，再实施、真实桌面交互和截图人工复核、聚焦正向功能测试、必要的授权 GPT-6.1 Sol 流式验收，范围提交、同步上游和正常推送后继续；未要求停止。本批不创建分支或工作树，不操作用户进程，不新增或运行 UI（User Interface，用户界面）自动化测试，保留其它任务的源码、文档和暂存内容。

上一批文件点段身份与精确 Git 基线已提交并推送 `3cd1a8469`；已重读其 Recall、实施和失败证据。该记录末尾的“待提交”是当时快照，实际交付已完成。当前工作区另有 Sources 恢复、产物焦点和用量交互等修改，均排除本批。

本批一层只读委托 file_alias_audit 审计 normalizeProjectFilePath 全部消费者的合法根路径准入，functional_audit 审计复制、移动、删除的成功回执与失败收敛；禁止再次委托。已读 AGENTS、07-panel 文件工作台合同、上一批记录、FileExplorerPanel、file-workbench、File.copy、路径测试和成熟 Native Host/CLI 服务启动及正常 shutdown 运行器。全仓搜索路径归一消费者、copy/move/delete 入口、applyCopyResults、目录缓存、主动搜索和修订订阅。委托反馈及真实前态仍待补充，不把代码线索当视觉验收。

## 现象、触发点与根因

一、复制多个文件时，每项 copyFileItem 独立发送真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）请求并在成功后返回 FileCopyResult。后端目标已存在时返回现行 FileConflictError，先前成功文件已实际落盘。Explorer 的 copySelectionsToDirectory 仅在整个循环成功后调用 applyCopyResults；后续成员抛错时 runMutation 显示错误，但已成功成员的目录缓存、搜索结果和选择没有立即更新。服务的 fileWorkbenchRevision 只被其它工作台消费者使用，不能替 Explorer 的主动搜索刷新。15秒目录轮询也不刷新当前搜索。相邻批量移动和删除已经在 finally 中消费已成功回执，07-panel 明确要求后项失败时仍刷新所有已完成成员。历史修复未把复制循环纳入同一收敛合同。

二、3cd1a8469 正确把相对 `.`、`folder/..` 归一为项目根 `""`。批量移动和复制的目标目录对话框在归一后以 `if (!targetDir)` 判缺少输入，导致真实合法根被拒绝。内部 joinExplorerPath 和目录加载早已用空串表示项目根，拖放进入根也用此合同。应在归一前区分原始输入缺失与合法根身份，不能恢复旧点段或另建根路径事实。单文件目标字段代表完整新文件路径，其空根没有文件名，仍按当前错误合同处理。此 primitive 消费项目相对路径，不把绝对输入称为根别名。

## 横向影响与风险

覆盖 FileExplorer 的单项与批量复制、菜单移动、拖放移动、删除、上传及目录创建入口，正常、后项失败、重试、目录刷新、主动搜索、连接/项目导航隔离和已打开文件资源回执。进一步全消费者审计待反馈；其它代码发现合法根判空时须先明确其字段是目录还是文件，不扩大为机械修改。

这是文件界面操作结果的收敛问题；尚无 Task/Mission/Session occurrence（执行轮次）的调度、队列、唤醒或恢复异常证据，不修改引擎。文件服务每项提交真实物理结果，不引入后备路径、复制批次事务、重复映射、重试成功项或新的队列。复制不移动原打开文件；移动和删除继续使用已有文件编辑者的草稿准入。已有 scope/authority/token 控制保留：项目切换后的旧结果不能更新新项目的界面。部分成功刷新之后，原第二项冲突仍应可见，而非显示整批成功。

本次只改已有动作控制流和输入验证，不增加正文或控件；现行中英文标题、错误和可访问名称保留。没有发现本批需清理的废弃实现。共享目录归一、权限、修订号、Git 基线和文件名字符合同不改变。

## 实施与验收方案

1. 复用已审阅 production Native Host 的 foreground ProcessFacade/Windows Job 与普通当前源码 CLI `serve`，全新本人隔离项目/运行根，私有 Bun 1.4 和正式 UI 同置 bin/ui；实际 /ui 响应核对私有资源入口。前态使用上一批最终正确私有构建，其中本批组件与当前源码一致；后态重新构建当前源码到新私有目录，不修改共享 dist-vite。固定每次900秒物理存活上限，手工进度检查，正常 /shutdown 收尾，核对 Host/Target 实例、输出 drain 与请求清理。无需模型参与此文件操作，不复制凭据、不新增 Provider 请求或合成会话消息。
2. 本人临时文件 source/audit-a.txt、source/audit-b.txt 和内容不同的 target/audit-b.txt；真实桌面搜索 audit-，按行实际 Ctrl 多选，Copy 到 target，确认第一项物理成功、第二项真实冲突、前态搜索/选择未更新，截图人工查看。另两组 subdirectory 文件实际批量 Move/Copy 到 `.` 复现拒绝，分别保留截图。前态不足处明确未知，复现后才实施。
3. 先保存并审查组件原差异；沿用相邻移动/删除的 try/finally 模式，成功回执非空时统一调用既有 applyCopyResults。对目录对话框在路径归一前验证原始输入，允许规范根为空；禁止修改单文件完整目标准入。完整审计反馈纳入实施边界。
4. 后态真实桌面重复部分成功和合法根操作。部分成功的正确输出是即时四个真实搜索行、选中实际成功的目标文件、原失败错误可见；磁盘逐文件完整字节核对 source 和冲突目标、成功目标。Copy/Move 到项目根后确认根中两文件、打开实际内容与正确项目身份。后态分别截图逐张人工复核；适当重复同场景中文界面，保留当前本地化错误。UI 行为只用真实交互验收。
5. 运行现行纯数据/服务正向路径与 mutation 合同、必要真实 File API（Application Programming Interface，应用程序接口）复制/移动合同；不新增 DOM（Document Object Model，文档对象模型）或源码文案断言。隔离真实服务请求和磁盘事实补足服务测试边界，不把模拟测试当端到端。Overlay 类型检查、私有正式构建、docs:check 和架构检查、独立源码复核。
6. 更新本记录、07-panel 相关公开合同和根/月/artifact 索引。使用私有 Git index 提交本批范围，保留共享索引中其它条目；fresh fetch/merge 后审查完整 upstream..HEAD，必要验证，正常 push；继续下一批聊天检索调查。

## 当前进度

本批文件修复、聚焦功能测试、独立复核、真实前后桌面与正常运行收尾已完成；范围提交和正常推送待收尾。下文保留完整阶段证据和未验边界，持续目标保持active。

## 前态与完整审计反馈

file_alias_audit 核对全部消费者：两处批量目录对话框是直接根路径回归；拖放、底层批量动作、创建目录/文件、上传、listing/cache 均已有合法空根合同。AppDialog 在原始值 trim 层验证必填，但返回原值，不修改文件名空白。单项目标代表完整 entry 路径，不改。没有 Explorer 文件 paste 或 LLM 工具直接消费此新 normalizer。

functional_audit 确认复制只有菜单生产入口，移动包含菜单/拖放，删除包含单项/批量。历史 `5e7b025103` 为移动/删除加 finally 却遗漏复制；`677f7afd17` 只加 authority（服务连接身份）隔离。无新的调度队列或引擎恢复缺陷证据。必须保留原 ownsOperation 和已退休 scope 的隔离。

18439 /ui 已实际呈现上一批私有新构建 main-BcMd5X5F.js。通过正常 `POST coding/chat/session` 创建本人隔离项目的空会话，由真实侧栏选择；没有消息或模型请求。英语桌面1280×720实际 Ctrl 多选 source/audit-a、source/audit-b 复制到 target：第一项已提交，第二项409；截图01只显示三行且两个source保持选中，遗漏成功的target/audit-a。切换到root-copy两文件执行 Copy 到 `.` 与 Move 到 `.`，截图02/03均真实显示 Enter a file browser path；只在本人的临时项目操作。四张截图已人工查看，00为初始主页。页面已关闭，服务正常/shutdown、Host/Target exit0及完整输出/请求收尾；凭据和模型目录从未移入。

首个隔离启动脚本在 dot-source FunctionsOnly 时把调用者 Port 覆盖成0；服务实际绑定7878，18439探针失败。已保存原startup/Host/错误；按原实例/实际7878正常/shutdown成功并观察端口释放，但Host报告AggregateError，保持failed记录，不伪称此发生实例成功。原allSettled同时等待handle.settled及stdout/stderr drain，旧catch未保存nested分支；父脚本已退出是有依据的输出失败线索，具体是哪项拒绝仍未知。修复为提前保存ownedPort/ownedPrefix，并加入startup实际端口校验；父脚本增加setup失败后的原错误落盘、正常shutdown与继续drain/join，Host新catch保留聚合子错误。完整新发生实例before02成功关闭，仅证明该完整运行资格；不以一次成功排除共享根因。独立file_alias_audit继续对Host/Task生产共享控制、所有生产入口及收尾/恢复代码做横向审计，原发生实例输出/请求完整资格仍未达成。

## 扩展：已证实的后端项目根保护缺口

全消费者审计发现当前 File.move/copy/remove 对source只检查原始空串；File.remove 的 `.` 经path.join等于Instance.directory，权限包含该根，stat为directory后进入recursive rm。file_alias_contracts 在25个不同的全新自有memoryProject真实TCP（Transmission Control Protocol，传输控制协议）API调查中证实：DELETE `.`、`./`、`folder/..`、`missing/..` 均200并实际删除该临时实体项目；raw空仍400 FileInvalidPathError。copy根到子路径仅偶然被self-copy保护拦截，move根返回OS错误导致500，均不满足稳定source根400合同。旧实现自基线存在，与本次前端归一无关。调查原事实存于 `.tmp-codex-file-root-01a133/root-mutation-evidence.json` 和 run-2.log，主agent已读原始路径/HTTP/实体状态，不对本仓调用删除。

另一独立自有项目通过祖先junction（Windows目录连接）再入根：终端lstat为实体目录，realpath与项目根相同；旧DELETE也200并实际删除实体根。终端root-link本身的remove/move则只操作链接节点，真实项目实体身份和marker保持。因此只判词法根会漏祖先链接，只按realpath一刀切会错误拒绝合法链接节点。目录目标根仍合法；源根mutation必须保护。

补充实施方案：在File/index.ts用一个共享source entry准入替换三处raw空根判断，复用现有relativePathFor/normalizeCanonicalPath/canonicalPath、isMissingPathError与lstat primitive。明确拒绝原始空源、已解析词法根，以及终端非symlink且canonical位置等于真实项目根的源；终端独立symlink节点保持现有移动/删除语义。source的一般绝对/空字符/权限校验仍由assertAllowedFilePath负责，不削弱现行拒绝；缺失路径保持原FileNotFoundError。目标basename/父目录/no-replace保护和copy publication不改。

新增聚焦正向真实API合同：三动作的词法根输入和祖先链接根输入映射400 FileInvalidPathError、source原路径及准确root文案，marker/实体身份仍为明确期望；项目自身为junction时词法根同样400；独立终端root-link移动/删除返回200准确回执与真实root内容，普通合法子文件复制/移动/删除与根目录目标明确输出。Windows本机可真实创建junction，POSIX symlink仅对应平台运行时才宣称。文件路径覆盖source/target、canonical根及terminal-link风险，存在外部文件的权限旧合同排除扩展。

进一步三项实际scope调查：本人新临时项目的scoped-project子目录通过合法 `.git` pointer/core.worktree 指向同一父Git根，实际Instance.directory为子目录、Instance.worktree/Project.worktree为父根。旧DELETE `..` 200且删除整个本人父项目。copy仅self-copy400、move500。保护范围须同时覆盖现有权限认可的 directory 和 worktree 两条根的词法与物理位置；相同两根无需另建持久化映射。source绝对/空字符/权限一般准入由现行assertAllowedFilePath保证在物理查询前执行，未知lstat错误必须显式传播，不能吞成“不等于根”。原始空源保持原动作root错误，缺失实体路径保持现行FileNotFoundError。目标根仍是目录而非源entry，可用于拼接子文件完整路径。

该后端非UI改动必须先验证旧失败，再实施与复测。委托file_alias_contracts限定File/index.ts、新API测试和scratch证据，禁止再次委托、提交或更新共享索引；主agent负责组件、spec、最终桌面、独立复核与Git交付。独立审查已指出复制/移动/删除沿既有finally模式的双失败边界：成员失败之后required刷新也失败会覆盖原成员错误；本批真实前后场景刷新成功，未宣称该未验场景完整错误合并，保留为后续调查事项。

## 运行器共享机制审计边界

file_alias_audit 源码横审 Host/Task 都经过supervisedProcessFacade到同一Windows Supervisor；Task只额外带taskID/cwd、租约和取消角色。物理退出、输出和请求清理各有实际证据，output失败但physical已证明时仍清理原请求；owner在实体/输出收敛后退休，未知实体状态保留或隔离，恢复按PID（Process Identifier，进程编号）、出生身份与occurrence核对。请求目录唯一，取消按Task/角色筛选，不共享跨项目目录。该临时运行没有执行Task/Mission/Session，不能据此宣称其串并行/重启矩阵实机通过。

Native helper监控其Host owner而不是外层PowerShell父脚本，父脚本退出而Host尚活时Target继续存活符合当前所有权。scratch外部stdout断开可使drain失败，生产mcp/browser/node-launcher同样pipe stdout/stderr，故不能将该类别提前降级为只scratch。原nested丢失导致精确分支未知；本批尚无生产该路径实际失败证据，不改生产过程机制。后续独立受控断sink调查保留在下一批事项中，不以正常before02补写原实例成功。原Host/Target的出生身份只读观察及实际7878端口释放另存before-physical-observation-only.json，此观察不能代替output/request资格。

前端当前实施仅三处控制流改动，独立functional_audit复核通过；正式私有构建exit0（2m15s）、Overlay类型exit0、146项纯路径/服务合同288断言通过。初次runner输入误用了不存在的project-directory/conversation-path测试名，前四文件通过但整体exit1；修正为真实meta-project-scope/conversation-history-path后六文件全部exit0，保留原日志，未修改产品来迁就验证工具。此服务测试只证明局部数据合同，后态真实桌面尚待完成。

## 最终实施与真实验收

File/index.ts 新的assertFileMutationPaths是copy/move/delete唯一source/target准入。原raw空源动作root错误优先，目标basename、source allowed、target allowed/parent顺序保留；两根词法相等直接拒绝，actual fullPath lstat区分独立终端链接，再对非link比现有canonicalPath的两物理根。只有ENOENT/ENOTDIR转既有FileNotFoundError，其余未知lstat/canonical错误传播。三个旧raw-root判断及重复路径校验同步删除；复制publication、no-replace、数据修订、权限和正常回执未另建路径。后端独立file_alias_audit复核源码、全部测试及真实后态日志，无阻断项。

复核参考[Node官方lstat合同](https://nodejs.org/api/fs.html#fspromiseslstatpath-options)与[realpath合同](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options)：前者区分链接节点，后者给出实际位置。该通用合同不代替Bun1.4/Windows当前junction与尾分隔符的真实运行证据。

新增18项真实TCP API合同最终294断言通过，包含 distinct directory 与 worktree 两物理根经ancestor junction重入、两实体身份/marker保留；作用域本身为junction时的词法根；Windows独立terminal link与带尾分隔符的相同link。实际Windows两种fullPath的lstat均symlink=true，move/delete准确200回执且root实体与marker保持。普通子文件copy到./copy.md、move到folder/../moved.md、delete及完整400/404错误映射通过。相邻8项Git读取57断言通过；26项后端正常package runner总exit0，两个package类型exit0、新测试Prettier和限定diff check均exit0。

初次新增测试3pass/16fail保留：12项真实source-root缺口；3项作者误写missing-source文案为File not found而真实合同含entry，已纠正期望；1项额外parent-worktree目标回执500属于下述既有独立缺口，已从本批验收移除且调查数据保留。不能把16项全称产品root缺陷。首次后态18项240断言通过，最后扩两根的ancestor场景后18项294断言通过；不以较早日志覆盖最终命令。

18440 全新after发生实例使用实际私有bin/ui入口main-D5xckEg5.js。正常公开接口创建本人项目空会话、真实侧栏选择、打开Files；没有消息注入或Provider请求。英文桌面真实Ctrl选source两文件Copy到target：第二项409后出现四个真实搜索行，成功target/audit-a唯一选中，原target/audit-b冲突仍可见（图01）。根目标`.`批量Copy root-copy两项成功，四个源/目标搜索行及两个根目标选择准确（图02）。切换本人隔离页面中文，再Move root-move两项到`.`，显示“已移动2项到.”和两个根文件（图03）；打开root-move-a.txt显示ROOT MOVE A和正常保存/重读/关闭控件（图04）。八张前后截图均已人工查看，本批默认只验桌面1280×720，不扩其它设备。

真实同一18440生产服务与磁盘checker逐项核对10个文件：两个复制源、成功/冲突目标、根复制的两源/两目标、根移动的两目标，完整明确输入字节（含CRLF）和真实File.read type/content/revision全部一致。copy/move/delete source`.`分别400 FileInvalidPathError、原path和准确root文案，真实root内marker仍为预期；见after-physical-and-live-api.json。此实页服务证据与测试TCP端点分开记录，不把模拟合同冒充端到端。

after页面已关闭，正常/shutdown200，Host/Target exit0、stdout/stderr drain和request cleanup完整、原实例gone及18440释放；父launcher joined exit0。原before失败发生实例的nested精确原因仍未知并保持failed；before02/after完整发生实例分别通过。无凭据或模型目录复制，无用户进程操作。docs:check348ops/26groups、architecture-index19docs通过；最终Git范围与正常推送正在收尾，持续目标保持active。

## 后续已证实缺口与未验边界

独立scratch真实确认：当directory为项目子目录、worktree为父根，create/copy/move到../*.md物理发布完整正确内容后，nodeForPath→isIgnored使用directory相对路径却加载worktree规则，ignore库对..\\*.md抛RangeError，API返回500 UnknownError；父目录listing同失败，delete正常200。nodeForPath只有create/move/copy三个调用，list有另一同语义实现；upload和remove不走此metadata。worktree-receipt-evidence.json保留实际scope、输入、准确物理内容和错误cause。下一批先分析并修这一共享receipt链，不把该未修功能称本批通过。

成员失败后required目录刷新也失败的原错误覆盖，仍是共享未验场景；原Native Host aggregate分支缺失及生产外部sink断开场景尚未实测；POSIX（Portable Operating System Interface，可移植操作系统接口）API/junction替代symlink与真实EACCES/I/O（Input/Output，输入输出）故障未在Windows本机诱发。切换语言时前一动作已经格式化的提示仍可暂留旧语言，当前新动作显示正确中文；旧提示语言事实投影列后续UI调查，不称全面locale动态收敛通过。

## Git 收尾阶段记录

普通fetch成功，提交前merge最初因其它任务的共享README未提交调整而拒绝；没有stash或覆盖该内容。采用私有Git index从最新HEAD构造本批三个源码/测试、spec/artifact及精确共享文档添加。首次stage diff检查指出原Native Host脚本快照末尾空行；改用完整原字节gzip归档该快照，未修改已运行源或裁剪证据。第二次普通commit因另一个授权交付把HEAD从585c2914e推进到ebaea7f6f而被Git引用锁原子拒绝，未生成本批提交，也未覆盖远端/其它暂存。保留原commit失败日志，再从新HEAD准备范围提交。后续实际提交与推送以当前Git历史和最终交付回执为准，不在本记录预写成功。
