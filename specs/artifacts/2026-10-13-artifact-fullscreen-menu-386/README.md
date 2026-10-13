# 386 全屏菜单键盘循环：真实桌面证据

2026-10-13，同一真实 Chat `ses_hVS7dJNLzINUMa8gSm91`、原生 `file-preview@1` Reading notes 和 `document@1` Desk note。产物来源沿用[384真实模型证据](../2026-10-13-artifact-action-focus-384/README.md)，本轮无模型调用、无凭据复制。修复分析及完整消费者见[386规格](../../records/2026-10/2026-10-13-artifact-fullscreen-menu-386.md)。

## 修复前

- [普通祖先样式](normal-overflow-chain.json)、[全屏祖先样式](fullscreen-overflow-chain.json)：根 overflow 从 clip 变为 hidden，首个滚动祖先均为 chatScroll。
- [真实菜单物理父链](document-mouse-menu.json)、[鼠标菜单](screenshots/document-mouse-menu.png)、[ArrowUp菜单](screenshots/fullscreen-arrowup-menu.png)：同一全屏文档两条绕过打开前滚动的分支成功。
- 独立 Return 调用约30秒超时并重置操作通道；此前完整前态和384后态同样失败，原回执见384。未捕获 CPU profile，不伪称有执行栈。

## 修复后人工复核

- [英文文档 Enter](screenshots/after-document-enter-en.png)：菜单展开并聚焦 Desk note.md；[空格](after-document-space-en.txt)、[Down](after-document-down-en.txt)、[Up](after-document-up-en.txt)、[鼠标](after-document-mouse-en.txt)均能正常操作；[Escape](after-document-escape-en.txt)返回下载按钮。
- [英文文件 Enter](screenshots/after-file-enter-en.png)与[中文文件 Enter](screenshots/after-file-enter-zh.png)：实际长文件可继续键盘操作，菜单项保留真实文件身份。
- [滚动后正文](screenshots/after-file-reading-position.png)与[滚动后菜单](screenshots/after-file-scrolled-menu.png)：人工查看两张图，顶部均为行74/Note72；[退出全屏后的嵌入菜单](screenshots/after-embedded-menu-en.png)仍从该阅读位置显示。
- [普通 More 菜单](screenshots/after-general-menu-en.png)通过 Enter 展开并聚焦真实首项；[中文文档空格](screenshots/after-document-space-zh.png)显示本地化类型、下载、关闭与原始正文。
- [真实下载逐字节比较](download-comparison.json)：文件14687字节与规范原附件相等，文档101字节与自然发布正文一致；保留[文件](downloaded-reading-notes.txt)、[文档](downloaded-desk-note.md)。浏览器重复下载将磁盘名加 `(2)`，菜单仍显示原名。下载后焦点返回按钮，见[文档回执](after-document-download-en.txt)。
- [复制反馈](after-copy-en.txt)显示 Copied 且焦点留在复制按钮。本轮 CUA clipboard readText 返回空字符串，不能据此证明系统剪贴板字节；实际复制内容的此前验收仍以384为准，本次未改复制路径。

这些是主 agent 在真实 `/ui` 上逐步操作、截图并人工查看的记录，不是 UI 自动化测试或 DOM 断言。截图显示实际浏览器默认桌面尺寸，未额外扩展移动端。未声称其余全部菜单消费者都逐一视觉验收。

## 构建与物理收尾

- [私有Vite构建](build-after.log.gz) exit0，7300模块，约63秒；既有重复导入及chunk体积提示保留。[冻结锁文件安装](frozen-install.log.gz) exit0，1668 installs/1914 packages，无额外版本升级。
- 前后scope均调用生产listener/recovery并在18499提供私有构建；无独立Vite服务。[前态ready](before-ready.json)、[后态ready](after-ready.json)、[前态terminal](before-terminal.json)、[后态terminal](after-terminal.json)分别绑定实际owner。
- [关闭与句柄完成事实](physical-closure.json)：前态42596与后态26324均正常exit0；tab20/tab21确认关闭，旧失败tab18仍在库存、关闭未确认。服务terminal的固定reason不证明tab18已关。没有关闭、刷新或重启用户窗口/进程。
- 最初误用Windows PowerShell 5运行基于`ProcessStartInfo.ArgumentList`的launcher，在子进程启动前报null；改用当前PowerShell 7执行同一脚本后正常启动。该本地运行器调用问题与页面验收分开记录。

补丁只修Kobalte Utils滚动遍历的向上推进，同步源码、ESM、CommonJS和两份source map内嵌源码；公开签名、初次查找及原滚动计算保留。[Overlay类型检查](typecheck.log)与[文档检查](docs-check.log)均exit0，不能代替上述视觉行为。
