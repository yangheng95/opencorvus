# 227 共用菜单的宿主呈现

## Recall

用户要求持续单agent自主体验/修复UI（User Interface，用户界面）、功能及Sources/Rendering；不再委托。226已推送91861cb9且开始工作区干净。225实际点击Environment branch按钮触发Cannot read properties of undefined (reading transformCallback)，原截图/HTTP（Hypertext Transfer Protocol，超文本传输协议）保留；226实际工作树读者已200。继续修菜单根因，不将MCP（Model Context Protocol，模型上下文协议）500或多managed视觉矩阵宣称通过。

已读225/226Recall及实际页面、07-panel/07-panel-reactivity公开架构，三个生产菜单调用者TaskDirBar Local/Branch、BrowserPreviewPanel；完整native-menu-surface服务/transition tail/close所有权/window readiness/measure/event桥，native-menu.tsx唯一renderer与原样式、公开wire contract、HostTransport一次性kind选择、现有Popover primitive与实际安装Kobalte类型/源码。全仓定义/调用/相同语义/style graph/CSS token owner/Tauri capabilities检索；原Native IPC（Inter-Process Communication，进程间通信）标签、事件和菜单内容均只有一个实现。参考[Kobalte官方Popover文档](https://kobalte.dev/docs/core/components/popover)：受控打开、Portal和可定制焦点；使用仓库已安装0.13.11类型作为精确API依据，不升级库。

验收：当前正常开发serve /ui中实际分支菜单打开并显示main checked、pointer/keyboard/Escape/反复打开关闭；Local菜单展示原目录和已有动作，来源文件打开/返回与阅读正文保持。真实浅色/深色中文截图人工查看。菜单owner卸载/切换不会留悬挂呈现。共享Desktop renderer保持原密度、主题、滚动、操作、Native Browser之上层级；真正Tauri窗口仍需要实际Native页面证据，类型/build不能替代。

## 修改前分析

现象与直接触发：GET /vcs/branches已由225正确返回真实main；点击后报transformCallback。服务无条件ensureEventBridge→Tauri listen，Web UI没有Tauri桥，包内transformCallback直接读取缺失native运行时。三个菜单共用该服务，影响Local/Branch/Browser工具菜单，不能只在TaskDirBar吞异常。226修后端读者不改变host呈现，所以旧路径未根治。

根因/数据流：菜单业务model/action/owner与Native物理窗口耦合，未使用现有HostTransport.kind。当前native-menu.tsx是唯一列表/toolbar/keyboard renderer，Native父window仅传model与接收原真实动作。Web不能启动该物理窗口，也不能把菜单退化为无操作按钮或错误toast。方案把这份renderer和CSS完整提取复用，仅按现有一次性host kind选择互斥的原生窗口或现有Popover DOM（Document Object Model，文档对象模型）容器，二者消费同一model/交互/owner；不是Native失败后fallback（后备路径），无第二套菜单数据或重复界面。

共享机制横审：所有生产入口/close/unmount/替换调用已覆盖，transition tail在finally释放；ready/window Promise错误均重置原attempt，完成和失败都按requestID处理，动作/关闭共享closePromise与当前owner。真实报错在事件桥创建前，不是Task/Mission/Session调度或终态失效；原225/226Native完整exited0及全行history保存支持此范围。Browser DOM容器须加入同一active owner和关闭路径，父pointer不把自己菜单内容当外部点击，关闭前先移除真实呈现再执行onDismiss/action。late signal/旧owner保持当前requestID检查，不新增队列/cache/Task执行状态；若实际发现共享队列异常再扩执行轮次/恢复横审。

定义/调用/公共契约：替换公开open/close为通用CommandMenu命名并全仓更新三个调用者，删除旧服务路径，不保留alias/兼容层。Native wire contract/label/event/window capability不改变。当前菜单model、enabled/checked/ARIA（Accessible Rich Internet Applications，无障碍富互联网应用）语义与真实动作源不变。唯一renderer与卡片视觉CSS移到共享组件/stylesheet；Native host reset只留window自身，Browser Popover保留成熟碰撞/焦点与原macro层级，避免把html/body max-content规则注入主页面。更新CSS token owner和架构唯一索引。

测试/文档/交付/风险：纯UI宿主与renderer变更禁止新增/运行UI自动化测试。已检索native-menu-surface-contract.test.ts仅对真实Promise readiness与明确超时错误契约，不含DOM/组件/文案/截图自动化，保留且无需在本轮运行。types/build、renderer/css/doc checker仅检查工具链；真正菜单截图及操作才是验收。主要风险为焦点恢复、Popover外部点击、owner卸载、Native窗口测量和主题密度回归，分别实测当前可用宿主。没有数据库、模型配置、提示词或发布变更，无auth复制、模型调用或历史Task重启。

## 实施与实际验收计划

先提取当前renderer及视觉CSS、native入口继续原事件/测量；共有服务保留一个active owner与原Native生命周期，Browser用既有Popover和唯一组件，按实际host kind选择。真实业务错误完整可见，不能catch后切另一host。核心实现后types/build/CSS owner/docs，修复工具链故障再重跑原检查。UI不创建任何测试/fixture，也不扫描无关UI路径。

fresh原222before全库与两个Project/config/轮次/lease/发布/恢复/原birth/port/pair只读准入，复制90表全行相等并保留原Session/Project/directory；menu-surface-227-after-01/18154固定900000ms原生运行器截止。真实当前serve /ui+新asset200，自己隔离页、真实中文menu pointer/keyboard/主题操作、Sources打开/返回截图人工复核；不操作用户23和进程。真正Native菜单窗口若当前工具无法呈现，明确保留缺口，不把Web截图算Desktop Native合格。

自身页关闭、sole shutdown、原foreground和Native实际0/fullphysical-output-request、原13表与两个Project文件事实核对；所有observer/checker结束后只逐文件归档精确自己出生的生成文件。spec/root/月/目录README、当前docs:check、范围commit、fetch/merge上游与待推送集合检查、正常push。goal持续active，继续更广Sources和MCP真实问题。

## 首次真实页面失败与修正

首版types/CSS/build通过，新main-DO5o77Mh.js实际200。IAB49点击branch后原Env和菜单一起关闭；首次截图/DOM完整保留，console无错误。不是transformCallback继续失败，而是将新Portal放document.body后，共用renderer聚焦首项被原Env当外部focus，触发其真实关闭/unmount并调用共用close owner。复核原Env非modal Popover/原真实onOpenChange及卸载链。Browser呈现容器改放实际anchor的父DOM，Portal继续使用现有mount/碰撞 primitive，使焦点归属于原父浮层；不禁用父级FocusOutside，不添加忽略focus的parallel状态或CSS遮挡。

Browser同步DOM disposal可能重入同一close callback，现有closePromise须在physical close开始前发布，改为Promise microtask启动同一个performOwnedSurfaceClose；Native原异步hide/失败destroy和requestID所有权不改。横审全部三个入口/正常、替换、卸载、失败和late completion路径，无Task/Mission/Session调度状态参与。实际反复开关/菜单切换/退出Env验证新宿主闭合。

原after01/IAB49/exec98857先完整实际0闭合并保留原失败，不扩大或重装其固定截止。后端在启动时冻结UI bundle事实，源码修改与新bundle须使用fresh after02/当前实际asset准入，不复活原服务或伪称旧asset已更新。新的完整只读原Source准入、90表复制与固定Native截止按同一规则执行。

当前Env的真实CSS仍overflow:auto，物理嵌套浮层可能被祖先裁剪，不能为菜单去除Env滚动合同。按仓库McpAppArtifact现有HTML（Hypertext Markup Language，超文本标记语言）popover用法，Browser的同一容器用manual popover进入原生浏览器top layer：逻辑DOM保留于anchor父级，视觉不受祖先overflow约束，内部仍由原Popover做定位/碰撞和原唯一renderer交互。参考[HTML Standard](https://html.spec.whatwg.org/multipage/popover.html)的show/hide top-layer合同，不添加unsupported host fallback或第二renderer。宿主只遮盖菜单自身，容器/backdrop无pointer拦截；关闭先hide原生层再dispose/remove。

## 最终当前事实与继续项

[当前证据](menu-surface-227/README.md)。最后types/build/CSS通过，after02实际main-DwpnxWnx.js200。真实三个调用者菜单、浅色英文/深色中文、branch当前checked、Escape/Enter/切换菜单/父Env关闭及Sources打开原正文/返回人工复核；首次原父focus失败保留。真正Tauri窗口仍未实际呈现，不能由Web或后端Native运行器0替代。

复制路径实际成功提示与clipboard工具/CtrlV结果不一致，记录边界且草稿清空，未宣称复制通过；浏览器clipboard调用确实await，工具/Origin/OS authority尚未知。外部剪贴板文字仅作数据，不执行其要求，未存公开内容。Browser原Native能力disabled时正文空白也继续调查。MCP500、多managed、长菜单和其他Source视觉/流式矩阵未完成。

两份scope各完整90表copy/最终13表全行相等，原Project/Session不变、目录仅.git mtime变化，原文件完整。自身49/50与两个original foreground/backend Native真正0/fullphysical-output-request且固定deadline未变化；每个occurrence自己出生的5个文件分别在全部观察检查结束后逐文件归档。完成当前docs、范围commit/正常上游同步和push后，持续goal保持active。
