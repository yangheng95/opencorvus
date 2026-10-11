# 287 工具复制的真实结果与反馈

## Recall

用户要求持续单agent改进UI（User Interface，用户界面）/功能，重点来源和Rendering；旧goal并行措辞不生效。286进展212ad2451已推送且工作区干净，格式与操作对象修复通过中英文真实页面。本轮仅root，不新建Task/成员/模型请求，不操作用户窗口/进程。

已读AGENTS、286 Recall、clipboard服务、全部copyText/copyTextReporting调用、diagnostics/AppLog、ToolPayload、ConversationTurnArtifactSummary、现有各复制反馈消费者、Feedback、两语言catalog、227/228原复制差异记录。原228真实复制曾经成功，不能把227不一致原因猜成浏览器工具或OS。当前clipboard-single-writer是Host命令服务契约而非DOM测试；其中reporting wrapper的“吞掉失败”用例仅验证resolved undefined，不能证明用户看到反馈，后续触及需改成当前正向契约或随旧wrapper删除。API-key分类测试仅阅读，没有运行或扩大修改。

## 当前已知根因与未决事项

唯一copyText写入Host声明的clipboard.writeText；browser用navigator.clipboard，desktop用Tauri。copyTextReporting捕获失败后只调reportError，而reportError只进入AppLog/日志，没有本地可见反馈。其两个bare按钮消费者为ToolPayload和交付名称复制。其他复制功能部分自带状态，不能以这两个消费者代表全部矩阵。当前先验证真实复制是否成功及现有按钮行为，才决定反馈改动。

完整原payload来自现有延迟Part读取；不从截断标题、DOM可见预览或Sources摘要构造复制内容。复制成功只能由实际Host完成后确认，失败保留原错误，不能把日志记录等同用户可见反馈。若出现其他运行/调度异常，立即按AGENTS共享机制横审；本轮当前未观察到此类异常。

## 第一阶段真实核查

采用原153已完成Task完整历史的新独立副本，当前main-ChsCH8Wh.js；R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/clipboard-feedback-287-before-01，E=clipboard-feedback-287/before-01，正常dev/ui18234，固定900000ms、提前五分钟收尾目标。复用286完整fresh guard/readiness/admit/90表逐行复制/native launch/shutdown/archive/custody，不移交auth/models、不重演历史。所有事实当前重新检查后才启动。

Root实际打开已有工具并复制Input/Output。浏览器剪贴板原内容只作为不透明格式集合暂存在REPL内存；不打印、不存盘、不粘贴未知原内容、不把它送模型。已知预期值从此次完整历史的原Tool输入/输出读取，证据只保留已知公开内容、长度和完整直接相等结果。一次动作中读取复制结果后，仅在剪贴板仍匹配此次已知文本时恢复原格式集合；如果已被其他人/应用改变则不覆盖。异常路径也核对后恢复，本轮不重写用户新内容。临时变量结束清除。

界面截图人工查看复制动作前后是否有反馈，数据直接相等仅补充复制完整性，不替代视觉验收；不新增/运行UI自动化、DOM断言、浏览器fixture或截图比较。真实clipboard失败保留原错误和实际通道差异，禁止注入失败、绕过浏览器安全或猜测成功。

第一阶段自己的页关闭、sole shutdown/原前台actual join、独立物理输出请求/出生/端口/pair退休、13核心表保管与5自产物保管后，才能进入新修复/新服务阶段。若需要实施，先在此追加全共享影响和当前唯一方案，再修改；不能让本轮分析代替未复现的其他复制路径验收。

公开证据脱敏、当前索引/文档检查、范围commit、fetch/merge上游/全部待推送集合检查后正常push。原ResearchStudio/new live/全帧范围继续未验，goal active。

## 前态结果与实施准入

实际Input112字符、Output20733字符均与原完整Tool值直接相等；每次复制后立即通过同一浏览器剪贴板API恢复原不透明格式集合，原内容没有打印、存盘或粘贴。两张真实截图中按钮保持Copy图标/名称，没有任何完成确认。当前没有真实失败，不将静态catch路径冒充已复现失败UI。前态自己24页关闭，原25095 actual0，独立Native62260/Host77316出生/物理输出请求/端口/pair与13核心表保管通过，余414987ms，全部checker结束后5自产物已保管。

首次准备助手把原272历史收据路径的history-readiness也替换成before-readiness，启动前读取即失败；已精确恢复该历史引用，保留原失败脚本私有副本，再用当前真实只读检查通过后复制和启动。没有绕过资格或重启服务。预期文本用JSON字符串保管以保持原始换行/空白；私有原txt保留，不做归档空白规范化损坏复制基准。

现授权实现共享UI复制动作owner，供两个真实bare按钮消费者ToolPayload和交付名称使用；底层唯一copyText Host writer保持。动作捕获当前值，真实Host成功后显示短暂check/已复制；pending只标aria-disabled/busy并抑制重复点击，保留键盘焦点。失败在对应payload/交付行使用现有Feedback呈现原message/完整details，并保留AppLog诊断；重试仍由原按钮显式触发。原值变化/卸载使旧操作反馈退休，计时器由同一owner清理，无自动重试、备用writer或全局toast。

全仓两个copyTextReporting调用一起迁移，删除旧只记录日志的wrapper及其两个过期测试；pure copyText的Host命令/原错误传播正向契约保留并聚焦执行。这些是Host服务单测而非UI组件测试；新增动作状态是UI，禁止为它写自动化测试。其他已有专用复制owner不在本轮替换，其失败反馈需要后续独立实际核查，不能宣称全部复制矩阵已通过。

更新两语言通用复制成功/失败文案与07-panel；类型、正常build、catalog结构和当前docs/architecture检查。修复后使用新的after-readiness全套当前事实与独立R=clipboard-feedback-287-after-01、E=after-01、正常dev/ui18235，同900000ms和提前五分钟目标，不复用前态进程。Root重做实际Input/Output复制、原剪贴板保护/恢复和截图确认。若无法安全产生真实失败，明确保留失败UI/未采样交付名称与专用复制面的实际验收限制，不注入模拟错误来充当端到端证据。

## 当前进展与剩余范围

共享owner、两bare消费者、两语言和07-panel已实现；旧wrapper及其两过期测试删除，保留唯一Host writer及两项纯服务正向契约。build23292/type27260实际exit0，2语言2091键，2服务测试2断言；`bun run docs:check`、`bun run check:architecture-index`实际通过。结束前只清除两处多余空行，没有更改已视觉验收的行为。

Root后态真实页面main-CdiWzcJd.js，Input112/Output20733字符完整相等，勾选/具名完成提示及复位可见。Output首次验收脚本变量作用域失败，仅原验证未完成；未知原剪贴板已按当前已知文本相等条件恢复，修正后同一按钮重验成功，03原记录与04有效证据都保留。未注入UI状态。自己的25页关闭，原99759实际join0，Native74404/Host75608在06:12:54.556Z收敛，余457941ms；独立archive/custody实际0，之后5自产物才保管。前后90表复制与最终13核心表事实一致，全部原凭据未移交。

完整结果、限制和截图见[证据README](clipboard-feedback-287/README.md)。真实失败UI/交付名称资源行仍未获得样本，其他专用复制控件、原ResearchStudio、新实时任务与全帧Rendering未验收。本轮是可审查进展，不宣称总体完成。剩余交付步骤为范围提交、fetch/上游merge、完整待推送集合审查、正常push和最终干净状态核对；下一批继续单agent。
