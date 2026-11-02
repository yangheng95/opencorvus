# 浮动控件的对话框归属（889）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，真实页面验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra文字。本轮承接888明确未修的项目下拉无障碍问题；888已推送a7ad77d684ff7b6a0a1a8e5cebda4899eee3c067，fresh HEAD=origin/main、0/0，36本轮普通文件/8本地化字段/三索引行干净，177项无关改动保留。源888-final严格合格259037行、schema9/92表、100项目/229附件，原句柄86299 exit0/关闭HTTP200/物理身份输出请求闭合、配对副本退休，累计1260模型请求。

888实页的可见Project journey773选项，其DOM（Document Object Model，文档对象模型）祖先DIV具有aria-hidden=true；原生AX（Accessibility，辅助功能）树及按辅助角色定位均未暴露选项，按真实DOM选项与可见文字仍可点击。原截图/只读属性观察保留。此现象不是工具角色差异的充分解释，本轮必须修共享层根因。

已读：AGENTS、888 Recall/失败与最终资格/fresh推送；07-panel弹出Project搜索、Dialog模态层、作品workspace/MCP pip及浮层归属合同；top-layer.ts全部现定义；ComboboxControl、SelectControl及Tooltip调用；ArtifactActions/ArtifactFrame的菜单、预览及窗口语义；Dialog真实Portal/Content结构与dialog.css根容器及内部滚动框；LogViewer内SelectControl和标题栏Help日志入口。全仓topLayerPortalMount定义/调用仅当前函数及ComboboxControl两处、SelectControl两处、ArtifactActions一处；其他视图通过这三个组件使用它。已查同语义的Dialog焦点所有者与原作品popover/fullscreen语义，不另造平行挂载器。相关文件检索未发现UI自动化测试，不运行任何此类测试。

仓库Kobalte（组件库）版本0.13.11，现patch包含类型、pointer层及Popper锚点跟踪等调整，未提供本应用的Dialog挂载归属。[官方Dialog合同](https://kobalte.dev/docs/core/components/dialog/)说明modal模式会把外部内容从屏幕阅读器隐藏；[官方Combobox合同](https://kobalte.dev/docs/core/components/combobox)说明Portal默认挂到body。当前文档站版本较仓库新，具体实现以仓库已锁定与patch后的代码为准，不更新依赖。

## 修改前根因与影响分析

- 可观察现象已有888真实证据，本轮before重现并截图：模态Mission创建中的Project选项可见但无障碍不可达。触发点是popup（弹出式）Combobox打开。数据/控制流为input触发Portal → topLayerPortalMount只找作品popover或原生fullscreen → 普通Dialog中返回默认body归属 → 子浮层成为模态内容的外部节点，被正常modal规则隐藏。旧路径只解决作品顶层，没有把Dialog列为当前所有者；不能用z-index（层叠顺序）或手动取消aria-hidden遮蔽问题。
- 在现单一topLayerPortalMount中，查找触发元素最近的Dialog或现作品popover所有者；若无此容器，原显式媒体fullscreen与普通页面语义保持。使用一个closest选择，避免外层workspace压过内层Dialog。函数签名/全部调用保持，Kobalte继续负责定位、碰撞、键盘、focus（焦点）与modal保护。Dialog根是覆盖视口的未裁剪容器，滚动发生在内部dialog-form，浮层应挂根而非滚动表单。
- 影响面：Mission Project的Combobox、SelectControl及其Tooltip、作品下载菜单。SelectControl的实际模态入口选LogViewer；普通页面对照用MissionBoard筛选/Settings，作品popover对照用源数据中真实现存作品的菜单/筛选。完整调用搜索及上述共享合同需一并复核，不能只截图单一Project字段就声称所有浮层通过。源作品具体身份与可用性在before只读盘点，尚未知，不构造消息或静态fixture（夹具）冒充生产验收。
- 公开API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、数据库schema（结构）/迁移、Provider/模型目录、Task/Mission/Session occurrence（执行轮次）、调度/恢复/终态与配置均不改。这里是UI的DOM归属，不是业务调度异常；如果实跑出现后者，按AGENTS共享机制要求横审全部生产入口，不能降级为个例。
- 风险：挂载点会影响层叠上下文、pointer（指针）事件、锚点定位、Dialog拖动后的菜单位置、Esc级联与焦点返回；需实际打开/筛选/选择/关闭并看截图。最近所有者同时覆盖嵌套Dialog/作品的正确优先关系，不扩展新的原生窗口或全屏行为。所有产品文案沿当前语言，不新增英文固定提示或状态。原模型/用户作品内容与技术标识保持。
- 纯UI改动不新增/修改/运行源码文案、DOM/组件、快照、Playwright test、浏览器fixture或像素断言。辅助只读DOM/AX属性是观察证据，实际页面交互与人工截图仍为必需；构建/类型/本地化/CSS检查不代替它。

## 首次资源与验收顺序

before/after首次模型额度各0，首次prepare前声明75分钟共同绝对截止与5分钟闭合预留，不加额、不续期、不重启。本人隔离开发CLI（Command Line Interface，命令行接口）端口38602/38603的/ui/；before复用888合格main-DMbAF13e.js，after以Node.js构建，不启动独立Vite。凭据与完整模型目录成对验证/复制，结束退休，内容不进入日志/spec/Git。源全部259037旧行、100项目文件/Git、229附件受保全，用户18571窗口和真实数据库不操作。

1. before真实打开Mission Project与LogViewer级别下拉，对照可见选项与AX/DOM归属；只读定位现有真实作品。正常shutdown200/原句柄exit0/物理身份输出请求闭合、配对副本退休及全数据资格后再改产品。
2. 修改现共享挂载器及07-panel合同。聚焦构建/类型/本地化/CSS（Cascading Style Sheets，层叠样式表）/docs检查。
3. after真实中英文Project搜索与选取，完整AX选项、键盘第一Esc关闭建议/后续Esc保留作者输入；模态Select选择/关闭、Dialog移动后位置、普通页面下拉及现作品预览菜单回归。只读核对归属与源业务数据，禁止为了填满场景调用模型或合成消息。未取得的覆盖明确标记。
4. 全部本人服务正常闭合、消费原句柄、配对副本退休、全旧数据资格、三索引同步；仅本轮提交、fresh fetch/普通merge/完整待推集合审查/正常hook与push/fresh 0/0。Goal保持active。

## before实际证据及实施确认

01真实Project列表可见，但当前选项最近Dialog为null，其body级DIV祖先aria-hidden=true，主背景overlayAppHost亦为true。原生AX没有列出项目选项。02真实LogViewer级别菜单也挂在Dialog外的隐藏DIV下；原生AX曾列出INFO等选项，但按辅助角色的INFO定位超时，直接DOM观察确认相同隐藏链，不能只凭一次AX字符串判定完整可达。普通点击仍可选INFO并返回原LogViewer。这是共享挂载边界遗漏，不是只影响Mission的字段文案。

只读源数据确认13份真实互动作品，选择art_g0VZTBLmD00zpCxK9m3M“批准后提交801｜交付概览”，原Session ses_-zUQWu4cFzzezMvaudl6/Project801。公开readSessionInteractiveArtifact HTTP200核对原id/session/message、document@1和标题。03通过真实已完成Mission打开作品及下载菜单，现menu归属原popover/role=dialog容器、workspaceOpen=true，fullscreenElement=null，菜单为原Markdown文件；Esc只关菜单，明确关闭再回原会话。没有构造新消息、作品或调用模型。MCP确认alertdialog检索为独立确认按钮层，本函数没有其内部下拉消费者，本轮不改其协议。

before原句柄97711消费exit0，shutdown HTTP200、原native/launcher身份/物理输出/请求闭合，配对副本两文件退休。严格保全259037旧行、100项目文件/Git、229附件、源DB及原认证/模型目录元数据，当前259039行只新增两条本运行lease（运行租约）；0模型请求/累计1260，原截止保持。按原方案仅改变共享挂载器的最近语义容器选择，不删除modal保护、不手动取消aria-hidden、不改调用者或库patch。

## after实页与组合退出边界（修复前分析）

main-C7oRKdYN.js的04项目列表已在AX暴露，并可通过getByRole(option)直接读取/选择。真实选项最近Dialog=missionCreateDialog，祖先隐藏标记均为空，背景overlayAppHost仍aria-hidden=true。05按角色选择journey773；06移动本人弹窗后重新打开菜单，实际锚点/菜单位置正常。目录短查询approved-code-801实际匹配原项目和两个匿名测试目录，ArrowDown选择了下一项；这不是错误路由证据。改用完整唯一目录后Enter选回真实Project801。

07首次Esc只关建议并保持表单输入；08第二次Esc进入888的原未保存提示，但09继续编辑后Project名称显示为空、旁边真实路径仍801，出现可读数据不同步。锁定库combobox-input.tsx的closed Escape分支直接setInputValue("")；当前两个Project调用的null变更请求被owner拒绝，selectedProject和目录仍保留。原首Esc修复只拦建议的关闭传播，未覆盖父表单未真正关闭时的受控名称投影。不能把这个真实组合问题包装为已完成。

追加final独立阶段，首次模型额度0，仍沿用首次75分钟共同绝对截止/5分钟预留，不修改旧阶段、加额、续期或重启。先正常闭合after并严格保全，再在现ComboboxControl的Escape路径中：建议已关闭、非组合输入且自定义处理器没有消费事件时，保留原传播；在库原生处理完成后读取当前受控value，若owner仍保留真实选项则以现optionLabel投影回输入。owner已接受清空/null或无受控值时保持其当前语义。不缓存选择、不改Project owner、不增加平行状态或协议，也不以阻断外层Esc掩盖问题。

影响搜索已覆盖全部ComboboxControl调用：Project创建/看板为真实受控选项；时区同样保留选项且已有disallowEmptySelection；命令面板和对话搜索value=null，对话搜索自定义Esc拥有优先权，均应保留原查询/退出合同。现非模态InteractionDialogHost只有Radio/Checkbox/文本/按钮，WorkspaceSplitLauncher是独立非模态Dropdown而非Dialog，没有这次共享Portal下拉消费者；不改变其授权或打开行为。依赖包自带测试名称曾随源实现搜索出现，未读取/运行其UI自动化用例，亦未修改第三方安装产物；本仓库对应源路径没有此类测试。

final从已闭合after数据与当前挂载修复继承，新增38604端口；以Node.js新构建，真实复验两个Esc后的Project名称、作者输入、普通看板筛选、中文弹窗、日志Select、时区/搜索调用的原语义及真实作品预览菜单。after仅完成已记录核心路径，剩余回归以final实页为准，不用其构建/类型检查代替最终视觉结果。

## final实际验收与交付范围

最终main-BeJWP6iR.js在38604真实开发页面完成以下交互，全部22张截图已实际查看，顺序与结论见本轮artifact目录的visual-review.csv。

- 10–12：英文Project建议的首Esc只关列表，第二Esc进入原未保存提示；Project仍为真实project/801目录，作者输入保留，继续编辑焦点返回请求。final只读观察的inputValue为project，与08–09真实失败对照。
- 13–14：日志级别INFO可直接通过辅助角色选项读取并点击，最近Dialog为logDialog，选项没有aria-hidden祖先，背景仍隐藏；选择INFO后再次打开/Esc只关菜单，原日志弹窗保留。没有取消模态保护。
- 15：普通看板按角色选取Project journey773，真实两张待执行卡片与其目录一致；闭合下拉的Esc仍显示已选名称。再选All projects恢复范围。
- 16：未保存的自动化表单搜索London，首次Esc恢复Asia/Shanghai；第二次Esc按设置页现有合同离开设置，另一次重开只验首Esc并截图。没有保存自动化、触发调度或新增模型请求。
- 17–18：中文搜索、选择journey773并双Esc，所属项目、实际目录、作者输入及中文退出提示均保留；继续编辑后明确放弃本人本地输入。
- 19：真实既存document作品在应用内窗口展开，下载菜单仍归属该popover/Dialog，原生fullscreenElement=null；Esc只关闭菜单，再明确关闭作品视图回原会话。
- 20–22：命令面板搜索真实Project journey773；Esc退出后Ctrl+f打开真实对话搜索，批准查询返回13条原消息，Esc按自定义处理器直接关闭并回原会话。value=null的搜索不会被本轮受控标签投影覆盖。

公开作品接口在before/after/final均HTTP200，同一art_g0VZTBLmD00zpCxK9m3M/session/message、document@1及完整记录相等。三个阶段分别259037→259039、259039→259041、259041→259043行，只各增加两条当前运行租约；schema9/92表、全部旧行、100项目文件及Git、229附件和源DB保全。三次关闭HTTP200，原句柄97711/86167/99386全部消费exit0，原native/launcher身份、物理完成/输出/请求清理闭合，认证和完整模型目录副本各阶段两文件退休。模型请求各0，累计1260；原共同截止未修改，final闭合仍余1372965ms。源认证/目录元数据保全，不在本轮再次刷新或输出凭据。

Node.js真实构建、overlay类型检查、本地化2753键/两语言、样式9052引用/402源文件及docs:check（352操作/26组）均exit0；真实页面证据独立于这些检查。没有新增或运行UI自动化测试。此次纯UI修改不涉及公共接口、数据库迁移、模型调用或调度协议。完整屏幕阅读器语音、原生媒体全屏、没有源实例的MCP pip及单独悬停Tooltip未实际验收，不能从本轮AX/页面证据外推；原分支保持且调用面已审查。

本轮交付仅共享浮层归属、受控选择的闭合Esc名称投影及对应架构/证据。下一批可继续审阅看板“Task已终态”的理解成本；原完成/失败/取消计数准确，尚未修改或宣称新的业务缺陷。Goal保持active，单agent继续，用户窗口18571未操作。
