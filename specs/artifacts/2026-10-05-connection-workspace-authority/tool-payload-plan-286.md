# 286 工具内容操作的对象与显示语义

## Recall

用户要求持续自主改善UI（User Interface，用户界面）、功能和缺陷，重点Sources/Rendering；最新仅单agent，覆盖旧goal多agent措辞。上一轮9611f5701已推送且工作区干净，当前真实子侧栏历史阅读/来源和往返通过，首载Rendering收敛。本轮只root，不创建Task、成员、委托或分支，不操作用户窗口/进程。原ResearchStudio旧schema/new live/全帧边界不由本轮替代。

已读AGENTS、284/285当前证据、ToolPayload及其全部三个InlineToolPart调用、共享Button/Disclosure、消息样式、两语言catalog、i18n结构检查器、locale preference/settings持久化与07-panel。全仓搜索ToolPayload、raw/readable/expand/collapse、group/controls与历史记录；没有目标UI自动化测试，检索到的MCP payload契约测试不是本组件，本轮不运行。沿用已应用的benchmark-debug-template，用户禁止UI自动化优先。

## 实际现象和根因

284/02真实展开工具有两个同名Expand和Copy，Input/Output的section没有可访问名称。284/03点击Raw后仅按钮变成Readable，输入仍空白；04另按Expand才可看见原输入。ToolPayload的raw与expanded两状态独立，模式按钮只改raw，而collapsed调用方正文以expanded为条件挂载；旧实现因此没有完成“查看另一种格式”的可见动作。默认折叠本身不是错误，本轮修改明确请求格式时的行为。

模式按钮还在Raw/Readable之间改名，却带aria-pressed。按[W3C按钮模式](https://www.w3.org/WAI/ARIA/apg/patterns/button/)，变名的动作按钮使用普通button语义；toggle的名字应保持稳定。[Disclosure模式](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)将aria-expanded和可选aria-controls用于所控制的内容。本轮以现有Button和现有状态为唯一owner，不引入第二Disclosure实现；Output已有有界预览/全文高度切换，不能直接换成隐藏整个正文的原生details。

## 实施与影响

ToolPayload给Input/Output/Details提供由可见标签命名的group，使用Solid现有createUniqueId关联标签和当前挂载的正文。展开和模式按钮的aria-controls只指向实际存在的正文；copy仍复制原props.value。增加两语言带label占位符的操作名称，保留短可见文案和原布局；Copy的提示也明确对象。可访问名包含原可见文案，中文使用“展开全文：输入”等完整前缀。

Raw/Readable作为普通变名动作，取消误导的pressed状态；改变格式时，若调用方默认collapsed，则通过原expanded状态打开正文。Output默认预览仍按原高度策略，已经展开的输入不被格式切换收起。没有新持久状态、协议、工具分类、解析器、截断或数据副本。Main/Side/子侧栏共用这三个调用；专用代码输出的现有section不改。模型、调度、队列、恢复和终态不涉及，没有发现此类新异常；若出现则立即按全入口横审规则处理。

纯UI改动不写UI测试或后端镜像测试；执行overlay typecheck、正常build:vite、两个catalog键/占位符结构检查，以及当前docs/architecture。结构检查不作为视觉或屏幕阅读器实测。

## 真实验收与交付

使用原153已完成Task全量历史的新独立副本：R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/tool-payload-286-history-01，E=tool-payload-286/history-01，正常dev/ui18233，固定900000ms，目标提前五分钟闭合。复用285成熟fresh guard/frontier/task+complete readiness/admit/full-copy/native-launch/archive/custody；当前schema、全部恢复/租约/消息/工具/内存前沿和原物理收尾重新核对，完整90表直接内容复制后才启动。不移交auth/models、不请求模型或重演旧任务。

Root真实打开已有成员的webfetch，确认默认Input折叠；用键盘激活Raw Input后内容可见且仍有Collapse Input，切Readable Input保留可见正文；再收起/展开、Output独立展开，观察窄Dock布局、焦点和数据。只用真实页面、截图和人工复核，AX（Accessibility Tree，可访问性树）/DOM只作观察，不写断言或自动化UI脚本。当前默认英文先完成；中文结构检查必做，若实际切换自身隔离页语言则记录并按其持久化边界收尾，不影响用户偏好。

关闭自己的页、sole shutdown/原前台actual join、独立出生/物理输出请求/端口/pair退休、13核心表与配置内容保管，所有checker结束后才保管5自产物。不延时或因观察超时重启。公开证据脱敏、索引/当前文档检查、范围commit、fetch/merge上游和完整待推送集合复核后正常push。持续goal active。

## 当前实际结果

当前main-ChsCH8Wh.js已经真实中英文呈现：Enter一次Raw打开输入，Space切阅读视图保留内容；Input/Output动作对象明确，独立收起/展开与焦点/窄Dock布局通过Root截图。浏览器settings只持久化自身origin localStorage，实际中文验收后已通过UI恢复English。copy值和数据路径未改，未宣称Clipboard或屏幕阅读器软件测试。

build19275/typecheck67200 actual0，2locale/2089key结构检查通过。fresh全源资格/90表完整复制、原19378 actual0、独立Native/Host出生物理输出请求/端口/pair收尾余566710ms，13核心表完整内容保管与5自产物保管完成。见[tool-payload-286/README.md](tool-payload-286/README.md)。原ResearchStudio/new live/全帧等边界保留，待范围提交和正常push后下一轮。
