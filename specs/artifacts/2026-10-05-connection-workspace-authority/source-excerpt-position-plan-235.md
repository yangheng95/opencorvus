# 235 摘要内部阅读位置

## Recall

用户持续自主迭代UI（User Interface，用户界面）/功能，主要Sources及子侧栏Rendering；最新只允许单agent，旧goal委托不执行。234已推送70a757c68，正文14px/21px与40vh真实多Source/3536/4600字、中文深色/来源目标通过；新真实失败为内摘要scroll1636→0。上一goal turn有源码/真实证据进展，当前git干净。用户IAB23/18107不操作，没有新模型/Task/子agent/branch/worktree/发布。

已重读234 Recall/原失败与完整闭合、SourceParts全部共享entry/group/identity/Excerpt/Tooltip、CardParts唯一caller与chronological source runs、SubagentConversationPanel active/requestKey/displayed/keyed body与32项外层handoff、conversation-ui当前两个presentation字段及task/session/workspace/main清理全部调用、Disclosure原生details/Show生命周期、现animation-frame scheduler、dom-utils外层reading/focus/native嵌套键盘逻辑、当前07-panel。全仓搜索未找到现成Source摘要位置实现或相关UI自动化测试；不新增/运行UI测试。

## 修改前根因与完整影响

234 after own72实际从Source region End、wheel得到1888→1636，whole Dock Close panel Enter→header Return后同child/group重新打开，内摘要0而外层阅读位置保留。原失败截图/JSON与current源码一致：Subagent inactive令requestKey=null，displayedConversation undefined，keyed body退役；32项handoff仅{top,following}保存外层。SourceEntry只有cardExpanded的展开选择，内部scroll仅DOM（Document Object Model，文档对象模型）自有，重建丢失。CSS字号/高度没有数据缺失或导致关闭逻辑；旧206/207只保存外层，176只移长摘要到正常阅读区，234只排版，均不含嵌套reader intent。

影响横审：共享SourceEntry在Main虚拟卸载、Side Chat正文生命周期、子侧栏关闭/切换成员/All agents和Source group/Excerpt收起时均可能退役；不能只为Subagent保活DOM或缓存transcript/focus。身份仍规范type/session/message/sourceId，raw snippet/DTO（Data Transfer Object，数据传输对象）/canonical chronology不改。主Task/session/workspace选择已通过既有UI store清理；API（Application Programming Interface，应用程序接口）authority revision与board selectEpoch是当前已存在的失效归属，不新增epoch/配置。没有Task/Mission/Session执行调度异常证据，取消inactive请求保持原机制。

## 唯一实施方案

1. 现conversation-ui store增加仅UI的SourceExcerpt readingTop记录，与展开状态同owner，复用当前MAX_ENTRIES_PER_TASK=200限制并在现primary选择/clear路径清空；不持久化localStorage、不存副本正文/DOM/controller、不另建cache服务。
2. SourceEntry的唯一阅读body提为局部SourceExcerptBody以绑定真实DOM生命周期。读取既有authority revision+规范sourceIdentity的键，capture现selectEpoch/authority；只从当前连接/选择、连接DOM且可见非inert区域的真实scroll事件保存top。**不在cleanup重新读取位置**，避免hidden几何归零或UI store已清理/selection尚未batch更新时写回旧owner。
3. mount用已有animation-frame scheduler恢复，ResizeObserver仅在挂载可见几何准备好时调度未完成的恢复。短暂pendingTop为该mount恢复意图，UI store仍唯一位置来源；不添加following/focus writer。新wheel/pointer/原生阅读键先取消pending恢复，让浏览器继续自然处理。cleanup取消frame/disconnect observer；owner/API/selectEpoch/source失效不写或恢复旧位置。未可见的0不覆盖最后真实位置。
4. 更新唯一07-panel契约，types/build/当前docs；新完整原171历史Sources4/3、3536/4600字的真实页面人工复核：native阅读到末段/中段→Excerpt收起重开→group收起重开→whole Dock keyboard关闭/header原生Return→tester往返/All agents→原文目标及中文深色；每步实际截图与辅助诊断。无DOM断言/注入或UI fixtures，不以types替代视觉。

风险/未知：窗口宽度重排/字号变化时以浏览器实际可滚动范围约束pixel位置，不承诺跨版面文本锚点；200条淘汰、API改变竞态、新stream与单→多瞬间、Main/SideChat真实卸载、Tauri GUI（Graphical User Interface，图形用户界面）仍需分别实际验证，不由child有限场景扩大。

## 独立运行与交付

原完整171Source/Task/Project/root/request见234当前事实，原foreg/native/pair已闭合；新的fresh Config/schema/全部Project/global/runtime/Task/Mission/Session请求/发布/交付/immutable ingress/current lease/capacity/permission/checkpoint/memory/14恢复前沿必须人工审查，不删/屏蔽。复用当前234成熟prepare/copy/native launcher/sole shutdown/current custody，90表逐行一致copy、不更换ID/目录、不移交auth/models或重跑原Task，fresh source-excerpt-position-235-after-01/18167固定900000ms正常dev `/ui`，实际当前asset200。自己的页面及时关闭；原foreground/Native actual0、全physical/output/request/独立birth/port/pair、13表全行/完整Project属性核查后，**最后**归档5个own exactbirth文件。修正234空LASTEXITCODE误判：PowerShell-only helper和native checker分开独立调用，实际逐一核对，不提前移动。

有文件改动则范围commit、fetch/merge upstream/完整待推送审查、正常push；持续goal仅单agentactive。源码改前保存SourceParts/store/07精确preimage；原234失败不覆写。

## 已实施与实际当前状态

两源文件/current07按上述唯一方案实施。types41591/build99240 actual0，current main-CcagVDdu.js/HTTP200。fresh完整原171全90表逐行相等copy，own74实际3536字End1888，excerpt/group重开1888；wheel中段1636 whole Dock header原生Return、tester往返、All agents返回均1636；独立4600字从0开始/新Home后重开0；中文深色End2035.333374 whole Dock前后相同。所有截图人工查看，具体已验/未验见[实际after](source-excerpt-position-235/README.md)。

own74closed，sole shutdown/原foreground70967与Native actual0，fullphysical/output/request/独立birth/port/pair闭合。current custody独立actual0、13表完整内容相等，Project仅.git mtime变化；完整差异复核/all observer终态后5个own exactbirth文件最后归档。原234失败和顺序错误保留，不伪改旧记录。doc/index检查与范围提交/正常push进行中；持续single agent active。
