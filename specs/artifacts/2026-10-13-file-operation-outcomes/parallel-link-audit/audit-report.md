# Terminal link entry / target / mutation receipt audit

## Recall

2026-10-13，root 授权下一批一层只读审计。前批 `2a47af74b71aa9de60f6c77b49a96685fca4c155` 已正常提交、推送并验收。先重读 `specs/records/2026-10/2026-10-13-file-metadata-feedback.md` Recall、实施和最终验收；本次只分析该记录明确保留的 terminal junction 分类差异及正常/破损 symlink 移动结果。禁止产品修改、暂存/提交、再次委托、用户进程操作、Provider 调用和用户界面自动化。主 agent 负责正式 spec、界面证据和后续授权。

本报告、调查脚本及日志仅在本人 scratch 内。真实传输控制协议（TCP）服务器使用公开超文本传输协议（HTTP）FileRoutes、Instance.provide、serverErrorResponse。每个项目由正常 runner 的 memoryProject 新建，验证 owner namespace 与 seed 身份；外部目标亦为本人全新独立 fixture。未触本仓或现存用户项目的数据。各服务器及 fixture 正常结束。

已读：File/index.ts 完整相关数据流，File routes/error handler、debug file 命令、SDK/OpenAPI FileNode、Overlay file-workbench/Explorer 相关消费者，当前架构 `07-panel.md`，root/ignore 精确测试，成熟 rename-no-replace 与 fs.cp 使用，相关 Git 历史。全仓搜索覆盖 File.Node、FileNode、File.list/create/copy/move/remove 全部生产调用及 lstat/symlink/junction/reparse/verbatimSymlinks 同语义实现。没有发现可直接复用的跨平台 junction subtype public primitive；不建议为此新增 NTFS 私有解析器。

## 可观察证据

`link-node-evidence.json` 保留 14 案例全部原始输入/响应、错误 requestID、directory/worktree/Project 身份、前后 lstat/stat 的 device/inode、readlink 原字串、realpath、真实内容与目录成员。`link-node-run.log` 保留 runner 和原始行输出，exit 文件为 0。

| 案例 | 首个 mutation HTTP | 真实结果 | Node 回执 / 下一次 list |
| --- | --- | --- | --- |
| junction-root | 200 | 同一 junction entry 原生重命名，readlink/实体目标保持 | directory + ignored=true / file + false |
| junction-child | 200 | directory 子 scope 与父 worktree 的同一结果 | directory + true / file + false |
| absolute-file | 200 | 同一 file symlink、原目标及 `LINK AUDIT owned exact 资料\r\n` 字节保持 | file + true / file + true |
| absolute-dir-symlink | 200 | 真 Windows dir symlink、同一 entry 和目标保持，显式浏览 GET 200 | directory + true / file + false |
| relative-file-break | 404 FileNotFoundError(path=moved-file-link) | **已完成移动**：lstat inode `5348024561578313` 前后相同，readlink=`relative-target.md`；新位置 followed stat ENOENT，原目标完整 | 无成功回执 / file + true |
| relative-dir-break | 404 FileNotFoundError(path=moved-dir-link) | **已完成移动**：inode `5629499538288969`、readlink=`local-dir` 保持，新位置目标 ENOENT | 无成功回执 / file + false |
| relative-file-retarget | 200 | 同一 link 原字串保持；新 parent 的目标 inode/内容变化为 `RETARGETED owned exact\r\n`，原目标 bytes 保持 | file + true / file + true |
| dangling-file-move | 404 FileNotFoundError(path=source/link) | 初始既存 link entry 保持，inode `6192449491710281`，未开始 rename | 无成功回执，原 source list 为 file |
| dangling-dir-move | 404 FileNotFoundError(path=source/link) | 初始既存 broken junction 保持，inode `6473924468420937` | 无成功回执，原 source list 为 file |
| dangling-file-delete | 404 FileNotFoundError(path=source/link) | 初始 broken file link 保持，inode `10696049119080778` | 删除回执失败，原 source 仍可列出 |
| relative-file-copy | 500 UnknownError | 日志明确 `File.copy symlink mismatch` 于 staging；source identity/readlink/bytes 保持，最终未发布 | 无成功回执 |
| folder-member | 200 | 真目录含相对 link 与目标一起移动；目录 inode `24769797954613527` 与成员 names 保持 | directory + false / directory + false |
| relocated-escape | 400 FileInvalidPathError | `Relocated symlink would escape the project directory: source/link`，源身份/内容保持 | 重试同 400 |
| external-target | 400 FileInvalidPathError | `Access denied: path escapes project directory`，指向另一 owned fixture 的源 link 与目标 bytes 保持 | 重试同 400 |

正常成功移动原 source 重试 404，符合原生 rename；两个已提交但误报 404 的相对链接同样重试原 source 404。原始 dot inputs `./source/link`、`missing/../moved-dir-link` 保持 MoveResult 的 raw previousPath/path；Node identity 仍规范 scope-relative。所有 marker 文件真实编码含 Unicode 和 CRLF，没有使用源码摘要替代行为证据。

Windows Git 实证（当前 Git 2.45.1.windows.1）：对 `/moved-dir-link/` 同一规则，junction 的 `git check-ignore --no-index -v -- moved-dir-link` exit 0，返回准确规则；真 `type: "dir"` symlink exit 1/空输出。child junction 返回 `/scoped-project/moved-dir-link/` 精确父 worktree 规则。因此 lstat 的 `isSymbolicLink()` 与 followed `stat.isDirectory()` 都不足以单独表达 Windows Git 的 reparse entry 语义。Git 官方普通 symbolic link 文档不证明所有 Windows junction 都相同。

## 数据流根因与旧路径

1. Node 存在性、entry 类型、浏览目标类型被合并为单一二元 type，且生产者使用不同事实：`nodeForPath`（约 1181）followed stat，`list`（约 1633）Dirent entry。目录 link 因而在成功 mutation/刷新之间切换 type 与 directory-only ignored hint。`createIgnoreMatcher` 的坐标已由前批修复，当前分歧是 caller type hint，不是规则 root 或 logical path 错域。
2. `move`（约 1364）在准入后 followed source stat；原生 no-replace rename 后先 notifyEdited，再 `nodeForPath(targetFull)`。relocated symlink preflight 只证明 declared relocated target 权限，不证明其存在性，也不承诺保持原目标 identity。这允许合法原生相对 link 移动后变成 broken 或 retargeted；Node producer 将目标 ENOENT 误当 entry ENOENT，在实际发布后 404。
3. `remove`（约 1490）也使用 followed stat 判 entry 存在。已有 broken node 能被 Dirent 列出，却不能通过 remove/move；未知 stat 错误亦被 catch-all 猜作 404。共享 source-root guard 已用准确 lstat 并保持未知错误，但动作随后又以不同事实作存在性判断，形成同一次操作的事实分裂。
4. copy 的 strict byte/link identity checker 使用 lstat/readlink 精确比较；fs.cp 却未设置成熟的 `verbatimSymlinks`。本次 relative-copy 500 已实际日志证明 link mismatch，位于 staging 校验且 cleanup 后无目标发布；这与 move 后 false404 的提交状态不同。不得把全部 500 宣称物理已发布。具体 runtime cp 的 staging readlink 文本未捕获，option 修复未在产品或此 fixture 验证，不能宣称已修。
5. `65d0bfc98` 的同函数已有 stat/Dirent 分裂、source followed stat、cp 默认选项。前批 `a0c45a9af` 根保护、`2a47af74b` matcher 坐标严格保留原类型方式；其相关测试刻意记录目录 junction receipt/list 两种 hint，本次若替换公共合同需同步更新这个触及的旧期望，不保留双源。

## 定义、调用与影响

- File.Node schema（42）五必需字段；FileRoutes list/create/copy/move response schema；SDK `packages/sdk/openapi.json` 与 `packages/sdk/js/src/gen/types.gen.ts:2236` 同 type enum。debug file list 原样输出 File.list。生产 File.list/create/copy/move/remove 调用仅这些 routes 与 debug list，没有模型工具直接消费 File.Node。
- Overlay `file-workbench.ts:9` 复制同 FileNode，365/390/404 等返回公开 Node。move service 只有 await API 成功后才 editor admission.commit 与 bumpFileWorkbenchRevision；故已 rename 后 404 使现 editor target 仍留旧 path。Explorer 收到失败也没有完成成员的 MoveResult 可用于刷新。该结果缺失不是并发 scheduler/Task/Mission occurrence 问题；无调度异常证据，不据此扩展队列审计。
- Explorer `selectionFromNode:338`、rows 564/567、contextTargetDirectory 749、后代/自目录保护 765、applyMoveResults 991、row 1652/1708/1715 消费 type。type 决定目录展开、click 文件读取/目录浏览、drop/upload/create 的目标、稳定行 owner key、选中回执和刷新的范围。对 list 统一 followed stat 是一个导航行为变更，而非仅图标修复。ignored 当前仅 data-ignored 展示，不提供权限授权；仍须统一其公开规则含义。
- HTTP mutation 错误使用现 NamedError/serverErrorResponse；500 返回公共摘要并以请求 ID 关联原错误。现 list routes 未完整声明所有 IO 错误 schema，这不是本轮允许直接扩清理的理由。
- Root safety 必须保留 directory 与 worktree 两根 logical/physical保护，使用实际 full operation path 的 terminal link/ancestor link 区别及 trailing slash 真实宿主语义。live 外部目标 source 当前 denied400；relocated escape400；未允许同一工程的全部 lexical child 绕过 physical permissions。
- 独立 owned Project fixtures 各有不同 identity；root/child 匹配实际 scope，未手工覆写 Instance。未实际跑并行跨项目 mutation，不把独立 fixture 通过宣称成并发隔离证明。前批已有并行 matcher 隔离证据，本轮没有改 matcher 或缓存。

## 最小修复建议（未实施，需主 spec 定义后授权）

建议首个可独立收敛的修复限定 **entry 存在性和 mutation 回执**，复用成熟 lstat、isMissingPathError、readlink、现权限与 native rename-no-replace、现 matcher；没有理由重写 Git、队列或发布所有者。

1. 一处 entry metadata owner 对准确 full path 使用 lstat。明确只有 entry ENOENT/ENOTDIR 才是 FileNotFound，未知 I/O 原样传播。source guard / mutation / receipt 不再把 followed target 失败猜成 entry 消失。list 与 receipt 应由相同投影规则产生 Node，而不是仅改一个 stat 调用。
2. 保持原生 link 文本及移动语义。相对 link 可以因新 parent 变破损/指向另一 admitted target；既然 preflight 允许且 rename 已完成，响应应描述已移动的 entry，而不能回源404或自动改写为原 target 绝对路径。若产品决定禁止 broken relocation，必须准入时明确 400 并在 rename 前检查；这将改变当前 relative-retarget/missing 合同，不能伪装成静态类型调整。
3. 最小兼容当前 list 的公共二元 type 可以先定义为 entry directory vs 其它 entry（terminal link 投影 file）。这能单一地描述 broken entry 并修 false404，保持当前 list 的导航边界和 entry 规则 hint，避免新增 SDK/schema 字段。此方案**没有完成目录链接浏览能力**；当前目录 link 在 list 一直 file，显式 File.list(link) 可成功，应把该未完成能力如实保留，不能宣传全面 symlink UX 修复。
4. 若本批要提供正常目录 link 导航，必须将 link entry identity 与 permitted browsable target 作为不同事实。现 type 可以被正式定义为可浏览目标类型、broken/denied link 非目录，但 ignored 不能自动宣称等价于 Git entry 分类。真实 dir symlink 与 junction 已有相反 Git 结果；不要添加 undocumented NTFS detector，亦不要用 full terminal realpath 改 Git entry 的逻辑规则身份。对字段/schema/SDK/Overlay 若扩展必须只有一个当前协议，并落盘精确浏览/拒绝/破损态。该能力扩大需要主方案明确，不应由后台单方面切换。
5. broken source move/delete 当前是先404保留节点。是否允许 move/delete 独立 link entry 是明确公共合同选择。若准入合法 broken link，应以 readlink 的 source/destination declared targets 验证 scope，不能单凭 broken link canonicalPath 的最近已有 parent 就判其目标 admitted。delete 不访问 target 与 live outside-target denied 现契约也须明确，勿借修复放宽任意链接权限。
6. copy 默认规范化 link 与 strict checker 不一致已证实。成熟 `fs.cp({verbatimSymlinks:true})` 在现 `expert-squad/manager.ts:1132` 已使用，可作为 strict link 原字串合同的单一选项；产品未改，需真实 API 正向覆盖 relative/absolute、目录成员、broken policy、no-replace 和 staging cleanup 后方可宣称。

## 权威资料与平台边界

[Node filesystem API](https://nodejs.org/api/fs.html#fspromiseslstatpath-options) 区分 lstat 的 link 本体与 stat 的目标；unlink 删除 link entry，目标内容保留。Windows junction 需 absolute directory target；relative symlink 以其 parent 解析，rename 不应私自改写文本。[cp options](https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options) 的 verbatimSymlinks 默认为 false；true 跳过 link path resolution。这些 Node 文档解释 mature contract，本次真实 runtime 为 Bun 1.4，仍以上述 HTTP/物理结果作实证。

[Git gitignore](https://git-scm.com/docs/gitignore) 明确目录尾斜线规则不匹配普通 symbolic link；本次 Git for Windows junction 有独立相反实证，不外推 POSIX。[node-ignore 官方 README](https://github.com/kaelzhang/node-ignore#pathname-conventions) 是纯 pathname matcher，不执行 fs.stat；调用方的 trailing directory hint 是元数据决策。当前实现仍是 root .gitignore/.ignore 有序规则，不是全 Git nested/global check-ignore。

POSIX/macOS 未实测；Windows 真 file/dir symlink 与 junction 均已建立成功。ACL EACCES、EIO、ELOOP、并发外部 unlink/替换、多卷 rename、UNC/网络盘、hardlink、特殊设备未实测。unknown I/O 必须传播是现通用契约，不把未测项称已排除。folder-member 本轮仅记录 moved directory identity 和一层成员，未独立读取 moved member link/content，不据该 case 宣称完整递归字节证明。终端路径带末尾 slash/junction root 再入已有前批真实合同，当前未重复；将来改变 lstat/direct remove 时必须回归。

## 实际验证命令及结果

PowerShell 于本仓 cwd，PATH prepend `D:/myhexin-local/opencorvus/.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64`，执行其绝对 bun.exe：

`bun.exe run --cwd packages/opencorvus test ../../.tmp-codex-file-link-01a133/link-node-audit.test.ts`

正常仓库 runner 进入隔离 checker：Bun `1.4.0 (34cbb9a40)`，1 个调查 test、14 次正向 owned identity 断言、14 个实际 TCP 案例；1 pass/0 fail，test 总 27.41s、runner 28.03s、exit0。该 pass 证明调查执行/新 seed 身份，**不**代表当前链接行为已正确；记录的404/500均真实旧态问题。

只读 `git --version` = `2.45.1.windows.1`；`git diff -- packages/opencorvus/src/file/index.ts` 空（已保存 product-before.diff）；开始/结束 git status 中其它并行改动均保留，没有本任务 tracked 产品修改。未跑 UI/全量 tests、类型或 build，调查未修改产品没有必要以这些静态检查替代真实行为。
