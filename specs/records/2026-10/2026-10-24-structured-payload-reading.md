# 结构化工具输出的阅读体验

## Recall

556继续用户授权的单agent自主迭代，优先Sources、侧栏Rendering与实际使用体验，验证后提交推送。旧Goal中的Astra委托已被后续用户禁止多agent覆盖，不委托。555是progress：e96d5ab6a正常hooks/push/fresh0/0，已知键盘/API标记与三次真实停止详情复制均通过；原43字符现象未复现，根因未知。555服务/页/原exec8805均闭合、0请求、catalog退休、原90表169304行保持。

工作区另有能力执行backend/plugin/package.json/测试及共享索引改动，全部保留，不修改或混入本批；后续新增的外部文件同样保留。共享索引按HEAD加本批入口精确暂存，提交前审查。已读552/555 Recall、552十九实图索引、当前07-panel及07-panel-reactivity相关阅读合同、ToolPayload完整实现、InlineToolPart Input/Metadata/Output调用、messages.css结构化布局、conversation-ui唯一披露/阅读状态。全仓搜索发现当前真实历史并非part中的tool，而是tool_part_request/outcome规范表，已改按规范持久事实查样本，未把第一次空结果当作无历史。

## 修改前分析与范围

现有552覆盖长网页文本的改宽/显隐，明确未覆盖JSON格式切换及专用code/diff。本批先覆盖真实结构化工具输出，没有已证明的新产品缺陷。ToolPayload对终态JSON做一次解析，树状字段按需挂载，原始模式保留原文本；raw/expanded/节点展开/limit和两模式readingTop进入现有conversation-ui记录。完成且展开的输出交给外层follow owner；有界输出在自身scrollport保存阅读位置。当前字段网格对嵌套对象改成整行，字符串保留换行。未知点为深层长文本的可读性、树/原文切换、内层滚动与侧栏宽度改变是否保持真实阅读目标；不得仅凭代码猜测修复。

规范只读历史样本：engine_task tsk_g00VYhrJxy00qIC54qvM，root ses_-zURI8flEzz7XOW5XhCo，orchestrator子会话ses_-zURI8ekpzzskoESwwiP，project prj_hlVwmME4dYUkGLOkDqOR。原read_agent_message请求prt_g0VYhsJQw00UlPV31v8w（message msg_hkmMhdvRpzBesxGR2RSm）拥有49192字符实际结构化结果，包含messages/origins/causal索引等原字段。实际Task和父子关系已由完整规范行核验，目录位于已隔离511历史scope，禁止按标题猜身份或合成结果。

本批只涉及展示/宿主阅读，不修改接口、schema、持久格式、Provider/调度策略或业务状态，不创建或委派模型成员、不发Prompt。若真实发现执行/恢复/终态异常，立即扩展为共享机制横向审计后再改。若发现产品根因，补全公开定义/调用/旧路径原因/风险和唯一实现方案后才编辑；没有证据则不造补丁。未有UI自动化测试被本次路径检索命中，不新增或运行UI自动化。

## 实页准入与验收

fresh structured-payload-reading-556，19155，20分钟原生进程边界、180秒启动无活动、至少五分钟收尾。完整复制正常闭合555的90表/原字段时间/完整canonical，源文件字节mtime保持；校验其0请求、公开shutdown/native/launcher/physical/output/request完整闭合及catalog已退休。只复制完整models用于历史目录投影，不复制auth、不执行Provider预检，真实请求预算0；主会话可能出现无认证提示，不将其当成用户热认证故障。静态UI使用已发布c3f最终包，确认实际入口main-_-Beyuq8.js；当前未提交backend另属工作，只读服务不资格化它。

内置浏览器2打开该规范Task，实际选择既有成员，展开原read_agent_message及Output，人工查看树状字段、深层展开、原文格式、原生滚轮、宽窄往返及工具页显隐；截图只覆盖实际完成的动作。通过可读性和同一原数据/阅读目标判断，不由DOM/构建/console或字符串断言冒充视觉通过。若需改UI，先保存前态，正常关闭原服务后Node构建到fresh自有bundle，再新服务捕获最终资产，实际复验后交付。

每scope及时公开shutdown并join原exec/native/launcher/output/request精确进程出生，完整catalog退休；源90表全部字段时间与源库字节mtime/canonical、目标原行差异、实际schema对象/version3/integrity逐项保存。真实非秘密证据与四索引、当前文档检查、必要类型/i18n/CSS检查；本任务全部改动范围提交，fresh fetch/merge/完整待推集合审核/正常push/fresh0/0。整体Goal保持active，不因单项实页通过宣称全部体验问题已根治。

## 已复现根因与唯一实现方案

前态页192加载真实Task。View orchestrator是选中主对话入口，不是独立成员dock，实际JSON资格来自主会话的原orchestrator输出；不把点击它后未打开dock说成成员页面已覆盖。UI selector的原生AX checkbox与DOM role查询不同，改用新鲜AX开关，不修改产品来绕过定位器。真实原文内部滚轮后top720，打开右dock使内容宽745→463，top仍720，原文从第三节附近回到前文。只读DOM定位记录给出窄宽首行原字符1173与宽栏1671，原part/stateKey相同；03/04/05实图已人工查看。不是对象/Markdown重新Rendering，而是内层像素读位不能描述换行后的内容位置。

直接根因是ToolPayload读位effect只保存readingTop/rawReadingTop，初次恢复后disconnect其唯一ResizeObserver；没有保存字符身份或在可见改宽时恢复。296解决DOM退休后同布局读位，552只把外层Main/Side/成员锚点扩到已展开工具文字，均未替代有界工具自身的像素状态。全仓确认两字段只有ToolPayload读写，Input/Metadata/Output三个调用共享该实现，conversation-ui为唯一内存记录；卡片折叠持久化不包含这些读位，所以此格式调整不涉及用户数据库或本地存储迁移。SourceExcerpt有独立摘录语义，尚无本批真实长摘录改宽证据，不在本次修改范围；专用code/diff同样不冒称已覆盖。

先将既有conversation-reading-anchor中的字符测量/解析提为可复用TextReadingAnchor原语，同一算法继续服务外层tool-payload锚点与内层有界输出，禁止复制DOM文本解析或新建阅读store。ToolPayload两模式读位在原有记录中各自保存top及可测量字符anchor，替换旧两像素字段；实际原内容复制/格式/展开limit保持。现有一个ResizeObserver持续观察该有界容器，用原一帧scheduler在可见尺寸变化恢复该记录，保存时保留仍可见的同一原字符。宽度已经变化而尚未恢复的原生scroll不得覆盖旧记录；真实wheel/pointer/key仍可取消当前恢复并接管阅读，不disconnect后续尺寸观察。完成且全文展开继续退出内层控制，外层follow仍唯一负责外层滚动。

风险是模式切换写回错误字符、隐藏容器覆盖读位、持续改宽逐行漂移以及真实滚动无法接管；实页必须覆盖窄宽往返、用户下滚后再改宽、Raw→Readable→Raw及展开/收起。Main原真实样本为本批实页，其他surface复用唯一ToolPayload但没有独立实图，不扩大结论。前态public shutdown200、原exec5777/native/launcher0、physical/output/request/精确出生闭合，reserve843307ms、catalog退休、0模型和原90表169304行零差异后才开始实现。

实施后fresh structured-payload-reading-556-after，19157，完整新UI包，仍0模型/不复制auth、同20分钟及五分钟收尾。实际源码CLI启动捕获新资产后重做相同真实Task输出阅读；若失败继续修根因并重跑，不以构建或新入口身份代替实图。

## 最终实页结果与后续边界

Node正式构建2m39s、Overlay类型检查通过；新19157页193实际加载main-DapVWEPi.js，原19155页192的main-_-Beyuq8.js前态分别保留。原字符1671在宽745→463→745始终位于同一首行，inner top720→975→722，实测顶边偏移-9/-10.5/-11px；不声称亚像素完全相同。Raw→Readable→Raw保持top722。真实滚轮改读到原字符3841后，第二次宽窄往返仍保持新目标，top1442→2164→1443，偏移-9.5/-10/-10.5px；全文展开/收起及嵌套树阅读后回Raw仍top1443/字符3841。十八实图已人工查看；JSON嵌套控件已展开和滚动，完整深层可读正文未独立资格化。

额外复制检查未通过：Copy Output显示checkmark，但独立剪贴板read返回361字符，逐字等于555保存的已知停止详情，而非当前JSON。未保存未知内容、不宣称当前输出复制保持通过；这推翻本批开始时“只有旧43字符未复现”的后续范围，已获得另一个已知旧值实例，根因仍未知。下一批优先比较未校准与已知键盘/API校准后的同页写入/读取/实际粘贴，以区分产品writer与调试通道，禁止猜测补丁。

19155/19157均public shutdown200，原exec5777/40481、native/launcher0、physical/output/request/精确出生闭合；余量843307/875704ms。全批0模型、未复制auth，两完整catalog副本退休、源9155406字节/mtime/内容精确保持。两个源90表169304行全字段时间、字节mtime/canonical保持，两个目标原行零差异，实际schema对象/version3/integrity保持，provider_activity_request421→421。

工作期间另一能力任务11ff4c56a已独立提交并推送，当前0/0；随后出现另一批video/artifact删除和索引改动，均非本任务产生，全部保留并排除暂存。本批只提交三个共享阅读源码、现有架构说明和本批记录/实图/索引入口。当前docs345ops/26groups与20架构索引检查通过，界面无新文案/CSS、无UI自动化测试；推送执行完整当前hooks。Side/成员/Mission独立页、长SourceExcerpt、专用code/diff尚未独立复验，不将共享代码等同于这些实页通过。

[十八实图与非秘密证据](../../artifacts/2026-10-24-structured-payload-reading/README.md)。Goal保持active，继续单agent。
