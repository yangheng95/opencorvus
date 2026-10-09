# 235 Source 摘要阅读位置

[Recall、修改前完整根因与方案](../../artifacts/2026-10-05-connection-workspace-authority/source-excerpt-position-plan-235.md) / [实际after证据](../../artifacts/2026-10-05-connection-workspace-authority/source-excerpt-position-235/README.md)。仅单agent。

## 根因与当前实现

原234whole Dock关闭让Subagent requestKey=null/displayedConversation undefined，正文owner退役；外层32项handoff保存top/following，但SourceEntry只保留展开选择，内scroll回0。共享SourceEntry同时用于Main/Side Chat/child，以及group/excerpt收起，因此选择现conversation-ui store作为唯一位置事实，而非为child保活DOM或缓存transcript。

新增UI-only sourceExcerptPositions，按现MAX_ENTRIES_PER_TASK=200限制，在primary Task/session/workspace现清理路径清空，不localStorage持久化。SourceExcerptBody绑定authority revision+type/session/message/sourceId，current选择epoch/连接/身份及visible/inert守卫；只保存真实可见scroll，不在cleanup读隐藏几何。mount现animation-frame/ResizeObserver等待可见后恢复，完成或退出注销；新native阅读输入可取消pending恢复，不改变focus/following/全文/Source动作。

## 实际验收

类型41591/build99240 actual0，实际HTML/main-CcagVDdu.js200。完整原171全90表逐行一致副本，无新Provider/Task。own74真实native/semantic操作并亲自看图：

- 原3536字End1888，excerpt及group收起重开1888保持。
- wheel到1636；Close panel Enter正确focus header，原生current-focus Return重开1636保持，修复原相同路径1636→0。
- dropdown到tester再researcher、All agents后当前researcher卡返回1636保持。
- 独立4600字初次0；End真末句，新的Home意图后close/open0保持，来源相互独立。
- 中文深色MDN End2035.333374 whole Dock前后相同；尝试wheel未证明另一个中文中段，按实际结果记录。

DOM/console仅辅助证据，未新增/运行UI自动化测试。中文文字原摘要不翻译或合成。

## 闭合与边界

own74closed、用户23/18107未操作；sole shutdown/原foreground70967及Native actual0，physical/output/request与独立exactbirth/port/pair闭合，原固定截止未延长。最终13表完整行相同、原Task/root/request/Project路径绑定，两Project仅primary .git目录mtime变化。current custody独立命令实际0/完整差异核对之后才归档5个own exactbirth文件；没有234的空LASTEXITCODE串联错误。

Main/Side Chat真实虚拟卸载、API/selection竞态、200项淘汰、resize/zoom语义锚点、pending frame内输入、新stream/单→多/Tauri GUI/活child Rendering未验证，不能据当前child场景宣称全部通过。范围提交/fetch merge/待推送审查/正常push，持续goal active。
