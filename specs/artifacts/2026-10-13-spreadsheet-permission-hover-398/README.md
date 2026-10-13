# 398 权限规则卡片深色悬停证据

对应[398规格](../../records/2026-10/2026-10-13-spreadsheet-permission-hover-398.md)。Root在自有tab40/41真实操作并人工查看前后态截图；audit_ui完成独立源码范围复核、归档，并人工对看before/after-dark-card原图。验收范围是当前真实Desk budget权限卡片的深色悬停、两个操作区域及相关说明文字；不代表全主题、全用户或整库无障碍合规。

[原最终人工记录](observations/final-review.json)和[全部允许清单](archive-manifest.json)是归档入口。39个原观察含19张JPEG、选定计算样式及少量AX；AX输出可能只是变化片段，不能称完整可访问性树。没有重跑[历史记录脚本](implementation/record-manual-review.mjs)，原reviewedAt=2026-10-13T16:33:36.486Z保留。

## 实际前后态

| 区域/动作 | 原始证据与结果 |
| --- | --- |
| 深色普通卡片正文 | [前图](observations/before-dark-card.jpg)、[前样式](observations/before-dark-card.json)；[后图](observations/after-dark-card.jpg)、[后样式](observations/after-dark-card.json)。真实:hover下背景从rgb(249,250,251)变为rgb(39,42,47)，白色正文保持；说明从rgb(125,134,152)变为rgb(168,176,189)。前态标题/正文几乎不可读，后态清晰可读。 |
| 深色普通Edit | [前图](observations/before-dark-edit.jpg)、[前样式](observations/before-dark-edit.json)；[后图](observations/after-dark-edit.jpg)、[后样式](observations/after-dark-edit.json)。真实右键仅把指针留到操作区，不左激活；各自:hover成立，背景从rgb(227,229,234)变为rgb(49,54,63)，白色图标保持。 |
| 深色普通Delete | [前图](observations/before-dark-delete.jpg)、[前样式](observations/before-dark-delete.json)；[后图](observations/after-dark-delete.jpg)、[后样式](observations/after-dark-delete.json)。真实右键观察同一局部色变，没有将右键当作删除命令成功。 |
| 深色全屏卡片 | [前图](observations/before-dark-full.jpg)、[前样式](observations/before-dark-full.json)；[后图](observations/after-dark-full.jpg)、[后样式](observations/after-dark-full.json)。同一工作簿和A1规则在全屏下使用相同主题来源。 |
| 后态全屏操作 | [Edit图](observations/after-full-edit.jpg)/[样式](observations/after-full-edit.json)、[Delete图](observations/after-full-delete.jpg)/[样式](observations/after-full-delete.json)记录真实各自hover及深色背景。 |
| 浅色对照 | [前图](observations/before-light-card.jpg)/[样式](observations/before-light-card.json)、[后图](observations/after-light-card.jpg)/[样式](observations/after-light-card.json)。同实例切Light，背景均249/250/251、正文27/28/31、说明125/134/152；浅色保持，不宣称浅色说明对比度改善。 |
| 中英同实例 | [普通中文](observations/after-dark-zh.jpg)/[样式](observations/after-dark-zh.json)、[全屏中文](observations/after-full-zh.jpg)/[AX片段](observations/after-full-zh-ax.txt)。原A1规则和HOVER-398 temporary说明保持，标题/正文/Add/空态翻译；最后恢复English。 |
| 指针移开 | [普通图](observations/after-pointer-leave.jpg)/[样式](observations/after-pointer-leave.json)、[全屏图](observations/after-full-pointer-leave.jpg)。真实点击标题使卡片:hover=false且背景transparent。原图仍留有范围绘制；A1同时处于选中和保护状态，无法据此独立认证范围highlight的完整显隐效果。 |
| 实际Edit/Cancel与Delete | [原规则详情](observations/after-edit-detail.jpg)为实际Edit打开A1/HOVER-398 temporary。Cancel关闭侧栏内容，原规则保留并经真实工作表菜单重新打开；随后只删除本scope规则，[中文空态](observations/after-cleanup-zh.jpg)确认清理。前态规则也有[清理图](observations/before-cleanup.jpg)与[AX片段](observations/before-cleanup-ax.txt)。 |

Root通过真实Tab/Enter Add打开Detail、正常Confirm创建临时A1规则。工作簿显示原7/5/12，未做单元格编辑、公式重算或新模型发布；模型请求为0。398未重跑context-command编辑回焦，397的既有证据是独立批次，不能把它写成本轮通过。

## 保留过程失败和准确边界

[final-review.processFailures](observations/final-review.json)保留三项真实操作/准备错误：

- 不限定Sidebar的HOVER-398 temporary locator同时命中description与Tooltip，strict失败；后来用实际侧栏作用域采集成功。不是产品出现了重复规则。
- 初稿AST编辑只匹配gray400，命中description和empty state，计数保护在写入前中止。最终脚本改为完整description literal，四runtime全部验证后才写入；empty state保持。这项原工具错误由Root过程记录保留，没有伪造独立失败日志。
- 中文采集猜成“侧栏面板”，实际无障碍名称是“侧边栏面板”，导致no_matches；读取真实AX后使用正确名称。不是产品中文错误，也不能据短AX变化片段声称完整语言验收。

独立range-highlight效果未与A1选择/保护绘图区分；上下文命令回焦未本轮重跑；多用户、多工作簿、移动端、全部主题、浅色说明对比度与WCAG整库合规均不在通过声明内。More Colors、Escape层级和Dialog Close语言继续属于分开的候选，不纳入本次配色修复。

## 精确实现与构建

[source-review](implementation/source-review.json)、[scoped-review](implementation/scoped-review.json)、[四分发清单](implementation/vendor-files.json)与[受限编辑脚本](implementation/apply-vendor.mjs)确认：每份SheetPermissionPanelList（UMD Yd）只改card 1处、Edit/Delete 2处及完整description 1处class。四literal之外完整源码一致，10个其它原patch段完整，总14段；空Bun缓存段已精确剔除。实际preset消费和私有SpreadsheetArtifact-DNLy2Js_.js同函数vIt中的1+2+1及既有CSS三规则已独立核对；没有复制完整vendor、UMD、CSS或构建目录。

本次新增内容保存为[有界patch字符增量](implementation/patch-increment.json.gz)：记录稳定Git基线commit、patch路径、56个精确UTF-8字节偏移和局部旧/新文本。最大单项2689字节，不含完整UMD长行或whole patch；在内存按倒序重建后与当时当前patch逐字节相同。这只是变更保存/范围复核，不是UI功能验收，也没有可变源码hash门。

[编辑输出](logs/apply-vendor.log.gz)、[patch prepare](logs/patch-prepare.log.gz)、[patch commit](logs/patch-commit.log.gz)、[最终install](logs/install-final.log.gz)/[exit0](logs/install-final.exit)保留正常工具链原输出。[类型检查](logs/typecheck.log.gz)/[exit0](logs/typecheck.exit)及[private build](logs/build.log.gz)/[exit0](logs/build.exit)通过，build1m4s；原chunk大小提示仍保留。上述整合检查不能替代真正computed styles和截图。

## 两次自有scope与canonical数据复用

[原launcher](implementation/launch-review.ps1.gz)与[原server](implementation/review-server.ts.gz)只作为成熟自有运行入口保存，归档未运行。launcher显式将OPENCORVUS_HOME绑定到已完成凭据清理的既有387 canonical runtime，读取原Chat目录；因此是**新的无凭据进程scope复用既有canonical工作簿数据，不是fresh DB**。原ready.source文字含“fresh credentialless runtime”，本目录保留原字节但以实际launcher路径为事实，不据该说明扩张数据隔离资格；没有复制该runtime或387原模型证据。

| Scope | 实际身份、关闭与原记录 |
| --- | --- |
| before | PID81704，occurrence cda2fe9e-c86c-408e-a8db-ca91ebc099be；tab40于2026-10-13T16:17:11.604Z关闭，elapsed305157ms、launcher join exit0。[owner](logs/before/owner.json.gz)、[ready](logs/before/ready.json.gz)、[stop请求](logs/before/stop-requested.gz)、[terminal](logs/before/terminal.json.gz)、[stdout](logs/before/stdout.log.gz)、[stderr](logs/before/stderr.log.gz)、[页面关闭](observations/before-page-closed.json)。 |
| after | PID72932，occurrence c8503fc0-aaa4-4843-a775-feb8cc4b0d59；tab41于2026-10-13T16:30:12.564Z关闭，elapsed397242ms、launcher join exit0。[owner](logs/after/owner.json.gz)、[ready](logs/after/ready.json.gz)、[stop请求](logs/after/stop-requested.gz)、[terminal](logs/after/terminal.json.gz)、[stdout](logs/after/stdout.log.gz)、[stderr](logs/after/stderr.log.gz)、[页面关闭](observations/after-page-closed.json)。 |

两次均在原1200000ms期限及deadline-60s之前关闭自有页面、请求正常stop并join。主题System、语言English恢复，zoom保持100%，只有自建临时规则被删除；[设置恢复AX片段](observations/after-settings-restored-ax.txt)及原人工记录限定事实。没有用户窗口/进程操作或本轮凭据使用。

## 归档安全和文件清单

显式68个源文件加README、manifest、[archive-check](archive-check.json)共71文件：39原observations（19 JPEG）、5个实施/复核文件、1份有界增量、9个日志/exit、12个scope记录、2个成熟helper。21个gzip逐一恢复原字节，JPEG没有编辑像素；原final-review未重跑。

有限凭据模式扫描仅针对允许文本、解压后日志/增量及本规格，局部链接和字节恢复是归档检查，不是UI自动化或普遍保密证明。未复制runtime/DB/auth/models、ui build、完整vendor/source/UMD、393/395旧证据或无关Git差异。Root负责共享架构/索引/changelog、最终docs、范围提交和上游推送。
