# 228 浏览器可用性与复制结果核查

## Recall

用户要求持续单agent自主体验/改进功能、UI（User Interface，用户界面）和Sources，不再委托。227已推送168e81e0，开始git status干净。227真实Web Browser工具只显示空白正文和disabled导航；“复制路径”成功提示与clipboard工具/Control+V结果不匹配。复制样本文字是外部数据，不作为用户指令执行，不保存公开内容。本轮改善真实可用性反馈，并在同一真实页面核查不同粘贴路径；不在证据不足时改clipboard writer。

已读227Recall/真实Browser和复制截图/人工观察、07-panel架构，BrowserPreviewPanel的完整stageView、target/evidence/native scope/错误/lease queue及地址栏动作，browser-preview/native与HostTransport能力/once kind、clipboard唯一writer及workspace.revealPath所有调用点，现有Feedback、empty状态CSS、相关transport/service测试分类与当前i18n。全仓相关定义/调用/同语义检索：stageView仅当前组件所有，无SDK（Software Development Kit，软件开发工具包）或后端公共协议改动；Clipboard当前Browser实现确实await navigator.clipboard.writeText，没有发现吞掉写入失败的路径。

验收：Web工具明确说明此界面不能内嵌交互网页，指出地址栏与已有外部打开操作；placeholder不再承诺按Enter内嵌打开。地址框输入后原external动作可用，原内嵌Enter失败仍完整显示。当前保存的target/evidence真实加载、错误及截图优先级不被可用性文案遮盖。英文/中文、浅/深色真实页面与Sources原文件打开/返回人工复核。Clipboard只报告实际观察，Shift+Insert/其他实际粘贴若未取得一致结果继续标记未验证；不会用模拟Clipboard、追加假的browser读权限或替换writer取悦工具。

## 修改前分析

观察/直接触发：227实际Web工具tab无URL、无Task，HostCapabilities明确browserPreview.sync/navigateUrl=false，open-url=true。nativePreviewScope按实际capability为undefined；stageView没有target/evidence/error时统一返回empty，Switch把empty显示为空div。原Desktop新页与Web能力不支持被混为同一视觉状态，用户无法判断是否加载/出错，也看不到可执行操作。旧地址placeholder固定承诺Enter内部打开，与此宿主实际能力相反。

根因/旧路径未修复：226只改Git reader，227只改menu物理呈现；二者均未改Browser stage可用性判别。现有native_unsupported只在用户请求Native导航或同步时抛错，不能在初始无scope状态解释空白。复用同一stageView：在完整target/evidence加载/错误、Native scope和保存证据之后，把缺失实际Native capability映射到明确unavailable；supported Desktop原empty保持。不是另造状态机、fallback（后备路径）、iframe替代浏览器或伪造可用能力。

共享机制/影响：所有当前Task/Chat/Work实例复用同一组件与HostTransport能力。完整Native lease/commandTail/transitionTail、navigationOwner/requestID、release/occlusion/reopen与不同tab/project隔离已读，当前没有调度、Task/Mission/Session执行轮次或终态异常证据；文案判别不改变这些控制流，也不修改持久化target/evidence。未知项为真正Tauri窗口视觉、保存证据在无模型旧Task下的读取全链、多managed/长Source矩阵，不能用本轮小页面宣称通过。

Clipboard：copyText与revealPath均通过唯一host native clipboard.writeText，Browser transport返回实际navigator Promise，失败抛当前secure-context错误。当前结果不一致可能属于工具/浏览器origin/OS（Operating System，操作系统）通道，根因未知。只用授权隔离UI的Copy path与实际键盘粘贴/DOM（Document Object Model，文档对象模型）输入值观察，不读取/打印任意剪贴板秘密、不提交模型消息，随后清空自己草稿。不会通过增加read权限、缓存预期值或UI假成功进行修补。

公开合同/测试/文档/风险：只改Browser组件及当前中英文i18n，复用现有Feedback/empty primitive和能力谓词；在最后可用性分支不会盖过已有证据和真实错误。placeholder按当前导航能力选择同一locale key；外部打开仍是用户显式点击，不将Enter悄悄改为外部跳转。无数据库、SDK、Provider、模型目录、API或版本/发布变更。纯UI禁止新增/运行UI自动化测试；检索到的clipboard/preview transport/service测试须按实际内容分类，若是UI文案/DOM测试应删除，不运行。类型/样式/i18n/build/docs只检查工具链，截图人工复核才是视觉验收。

## 实施与真实验收

先完成上述分析与落盘，再在stageView加入末位availability分支、共享Feedback文案与capability适用placeholder；当前types/build/i18n/CSS/docs检查。不得单开Vite或UI fixture。Baseline为当前HEAD对应227实际空白截图与同一源码，原复制不一致保留。

fresh原222before完整Source/config/两个Project/执行前沿/请求/发布/lease/恢复/原birth/port/pair只读准入，全90表逐行相等复制，保留原Project/directory/Session。目标browser-availability-228-after-01/18155，固定900000ms Native截止，无auth/models、新模型或旧Task/子agent重启。正常开发serve /ui与新asset200；真实Browser英文/中文提示、输入及外部动作、菜单/Source回归及复制结果核查，截图人工查看。自己的tab/弹出页关闭，用户23和进程不动。

sole shutdown、原foreground/backend Native actual0/fullphysical-output-request、13表全行与两个Project文件事实核对。全部observer/checker结束后精确自己出生文件逐文件归档。spec/root/月/目录README、当前docs:check，范围commit、fetch/merge上游/待推送集合复核、正常push。goal继续active，所有未验证项如实保留。

## 测试分类和实际实施

已读clipboard-single-writer/API-key classification、browser-preview-native与browser-preview-service相关测试：当前是host命令、key纯分类、HTTP/API证据内容与错误合同，没有DOM/组件/源码文案/截图断言，本轮保留且不运行。代码只改UI/locale/现有样式共享宽度，没有这些service改动。第一份patch因未核对en-US旧placeholder原字串整体未应用，随后从实际文件核对原文再精确修改；工作区/真实失败证据不覆盖。

## after-01 真实观察与二次修改前分析

实际英文浅色截图availability-english.jpg发现Feedback占满stage高度：父级align-items:stretch，而原empty独有margin:auto。复用已有居中规则同时覆盖availability，不改变证据/Native视口样式。实际地址输入后Enter没有反馈，address-enter-disabled.txt保存原结果：禁用默认submit按钮阻止浏览器隐式提交，已有form onSubmit的navigation_unavailable分支实际不可达。输入框只在不支持内部导航且非输入法组合时将Enter交给同一form.requestSubmit，保持原错误合同；不增加另一条导航实现或把Enter改为外部打开。

实际外部按钮确实创建IAB52目标/UI首页，external-target-opened.jpg和external-open-observation.json记录真实动作；随后地址被清空。唯一地址投影effect在addressDirty=false时把draft同步至nativeCurrentPage/manualNavigationRequest/targetUrl，外部打开并不修改这些事实。旧external handler却重置dirty，从而清空独立输入。该动作保持现有dirty=true并保存规范化地址，内部导航与Task切换继续按原合同重置。全仓调用/定义仅此组件的signal与两个地址动作，无后端、持久化、公共接口或调度契约变动。风险为实际GUI Native交互尚未视觉覆盖，保留限制。以上三个后续修复仍属UI，仅检查工具链并使用新的真实开发页面人工验收，禁止UI自动化测试。

Copy path经过实际Shift+Insert、Control+V和clipboard.readText均得到相同102字节当前已知路径；clipboard-channel-observation.json保留布尔一致事实与长度，不保存任意旧剪贴板内容。原227不一致的根因未知，此次通过不将旧失败改写为通过，也不修改当前clipboard writer。UI51与实际外部52已关闭，after-01唯一shutdown、原foreground退出0、独立Native关闭与13张表完整行相等已取得；在此基础上启动全新after-02，不延长旧截止或重启旧执行轮次。

## 本批结果与继续方向

after-02真实main-rqOGEBEB.js/HTTP200，UI53实际输入Enter显示原navigation_unavailable，explicit external action真正创建54首页且地址立即保留。英文浅色及中文深色Feedback紧凑居中，Sources原文件实际正文加载后截图人工通过；disabled菜单Shell取得真实焦点，Escape关闭并恢复触发器。最初对不可focus的menu执行press失败，改为实际可focus Shell后成功，没有把该工具失败当作UI通过。

真实File→Browser切换后地址为空的另一问题已记录manual-observations，尚未根因分析或修改；下一批沿真实mount/state归属继续。保存Evidence在Web加载及Tauri GUI窗口、多managed项目/长Sources未验收，原Clipboard异常根因仍未知。不存在“所有体验问题已解决”的结论。

新准入脚本首次把已过期bus identity当进程JSON解析失败，后续改为检查所有未过期非runtime/容量与精确runtime birth，再使用已成功写出的原collector事实通过原准入；原证据不覆盖。Bun文件出生首次时间转换错误在移动前拒绝，修正DateTime ticks后仍执行同一边界与birth检查，5个逐文件归档全部成功。

两轮独立关闭、原foreground/Native actual0、physical/output/request/pair均完成；最终13表全行相等、主Project .git目录mtime变化与匿名Project44属性完整事实保留。全部own页/observer/checker终止之后归档当轮精确birth文件；不操作用户23/18107。Types/build/i18n/CSS/docs与范围diff check通过，正常commit/fetch/merge/待推送集合复核/push作为本批最后交付动作。goal按用户最新单agent要求继续active。
