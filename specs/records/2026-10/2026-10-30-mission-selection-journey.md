# Mission 创建时的专家团选择

## Recall

持续单agent自主体验/修复、真实页面人工截图、聚焦正向验收、范围提交和正常同步推送，直到用户停止；后续单agent要求覆盖旧Goal的Astra文案，不委托。上一轮799是progress：62276682e6f4f03af42eb4e46ae464fd0b7f495d已推送，18:28:36Z fresh main=origin/main、0/0，自有文件干净。五列布局修复、中英文实页及Sources8条复制/打开通过；所有自有页面/服务和模型目录副本已退休，Provider累计993。其他会话当前190项工作区状态保留，只在真实冲突时等待，不新建branch/worktree。用户18571服务/页面、真实数据库不操作，已授权一次Dependabot重扫已消耗，不重做。

## 实施前分析与调查边界

已读当前07-panel连续目标与Mission创建合同、MissionCreateDialog初始化/搜索/上下文切换/安装/提交所有者、expert-squad服务API（Application Programming Interface，应用程序接口）路径、653/654实际创建与断网反馈记录、Goal所有者/附件生命周期记录。Goal主要入口与Mission手动草稿已被真实验证，本轮不把重复旧验收包装为新修复。实际待查是创建表单的搜索/选择反馈和类型切换：loadExpertSquadsForContext初始按active或首项选择；searchSquads通过generation+sequence+project+pillar隔离返回，合并保留已选项，用户清空选择后搜索不能重新选择。市场查询独立sequence并随query/pillar/project更新；安装回调另有lifecycle，是否有可观察错位未知，未操作市场安装便不能定性。

尚无新故障证据。候选问题线索包括：无匹配搜索但保留已选项时反馈能否明确、类型切换是否保留错误市场状态、取消后再开是否清除仅属原表单的内容。所有结论必须以当前页面、真实请求和当前代码流对应。禁用假响应、注入延迟、SQL（Structured Query Language，结构化查询语言）造业务消息或UI自动化。只查看本来公开的控件；不为找bug安装外部专家团或派发AI（Artificial Intelligence，人工智能）工作。

本轮先调查UI（User Interface，用户界面）选择与表单状态，没有接口、schema、迁移、调度/执行轮次改动；这些影响项目前不适用。若发现调度、恢复或终态异常，立即横审全部Task/Mission/Session生产入口、正常/终态、重试/重启、串并行与多项目，不能局部归因。只有具体问题深度/影响面、定义/调用/同义实现/历史、数据/公共合同/测试/文档/交付风险已补齐，才修改生产实现；没有新问题则保存有效新证据并继续其他范围，不制造代码改动。

## 固定验收方案

mission-selection-800：由关闭799-after库完整只读备份92表178180行，复制发布、package revisions及4处实际附件namespace。仅复制完整models目录元数据，无auth，RealProviderAudit预算0、累计保持993；模型配置不可用提示是明确隔离条件。复用当前main-rcW3RLPU普通前端，通过原生开发serve /ui在自有端口38367（基线）/38368（必要候选）验证，不单起Vite。独立页面/runtime/进程身份共用首次启动前固定60min admission，当前诊断shutdown owner按同一deadline减5min计算，完成即public shutdown；不得重开或延长旧Scope。

实际打开创建Mission，选Code/Work、搜索可匹配与无匹配、明确清空/再次选择、切换类型、取消再开；基于真实截图决定可读性。手动草稿只在需要验证其明确选择结果时创建，并给出明确有限命名，不启动AI/Goal/Mission或子Task。主页Goal只检查输入移交/取消，不重做已有执行验收。若有UI修复用普通隔离outDir构建、类型检查及同页双语人工截图验证；非UI修复需明确正向真实checker，不跑UI测试/组件/DOM文案断言。

服务关闭后原exec join、native/launcher0、精确物理身份/输出/请求三项结算，才清退自有模型目录副本。逐表原库/目标原行、schema9/integrity、全部原附件和QA7文件、分支/HEAD/index原字节核对；若存在本轮明确UI创建的合理新增/修改，按实际操作和唯一writer核验，不宽泛放行。新记录/证据同步三索引并跑当前docs checker；自有范围提交，fresh fetch/merge审查全部待推提交，再经正常hooks自动push。Goal保持active，原793审批工作流的历史问题和更广功能验收仍独立保留。

## 结果

## 已证根因与实施决定

800-01当前创建表单Code兼容目录默认选择Dynamic。800-02输入qzxvpkjq800后仍显示已勾选Dynamic，却没有任何“未匹配/保留项”说明；相同项目真实GET /expert-squad/search返回200、entries=[]、total_count=0，保存原始JSON，证明不是搜索实际命中。800-03的AX勾选动作没有改变界面，不能算清空；随后点击截图上的真实圆形勾选，800-04明确Selected0、Dynamic未选，仍只提示Select an expert squad而未解释本次搜索无结果。没有额外模型调用或业务执行。

根因为searchSquads在合并保留已选项时丢弃了匹配来源信息，expertSquads数组同时被当作可见目录和匹配结果；prerequisiteMessage先看合并数组非空，又只在已选0时考虑查询，因此保留项遮住空结果。旧654修复了搜索不得改选中项，合并保留行为本身正确，但没有保留“结果匹配/选择保留”这两个不同事实。只加文案或从包名关键字重算匹配都无法根治。全仓搜索mergeSquadOptions、全部setter、no_matching_squads/selection_help，仅当前组件拥有该合并与反馈；服务API仍返回真实匹配页。

实施：把当前单一目录投影改为一个包含options与matchingIDs的请求结果对象；初始加载、搜索和安装刷新均从同一真实page同步发布，保留项只承担可选目录身份，匹配身份不从合并数组猜测。上下文/重开原清理点同步清理这一个对象。搜索无匹配的说明放在搜索框下的可见区域，已有选择时明确说明其保留且继续允许提交；保留但不命中的行用现Badge primitive标明不在本次搜索结果中。清空选择时使用同一真实空结果提示作为创建前提，不重复显示两份反馈。新增两条英/中文本；包原始名称/描述保持，实际payload仍为原expertSquadIDs，不改变选择所有者、搜索算法、API/SDK或数据格式。此为UI呈现修复，不新增/运行任何UI自动化测试；聚焦类型、两语言键合同和真实截图/选择/草稿验收。

本轮未观察到调度/恢复异常，相关共享机制修改不适用；不操作市场安装。安装刷新只同步当前已有的page匹配身份，保留原显式安装选择和generation/sequence准入，不新建fallback或持久事实源。候选仍须人工看提示、Badge与提交是否明确，验证部分命中/零命中、清空/重选和切类型/取消后状态；若布局不清楚继续修改再截图。

## 当前实页与持久事实结果

普通构建main-Dk8FSgd1.js（约60s）、Overlay类型和两语言键/占位符合同通过（2625 keys）；后者只检查locale结构及插值，不是文案/DOM/组件UI自动化。候选独立38368 /ui使用同一原admission，没有复用基线进程。800-05真实英文页面解释零匹配、已选保留；Dynamic显示Outside this search。800-06实际清空后Selected0，原空结果提示在搜索区可见，创建前提准确。清除搜索仍Selected0；通过真实键盘Space明确重选Dynamic，再搜索Base，800-07/08是阅读位置过渡，800-09滚动后可见实际命中项及仍选中的Dynamic外部匹配标记。800-10切换Work清查询、按原上下文初始化选择，市场查询状态也随之清除。

裸Esc观察曾未退出，不据此修改primitive或宣称共享故障；明确聚焦创建请求输入框并发送Esc后，真实对话框关闭、焦点回到Create Mission。随后重开表单确认需求/查询/类型均为原初始状态。其他子控件的Esc归属没有独立验证，不宣称全部覆盖。

切简体中文后，显式选自有checkpoint-qa-795项目、手动创建、Code，输入标题搜索选择保全800及完整有限原文；用键盘明确选Base并取消Dynamic。再次qzxvpkjq800，800-11/12显示中文无匹配说明、保留选择和“不在本次搜索结果中”，创建草稿仍可用。实际点击创建一次，800-13出现待规划/手动草稿；800-14打开原草稿完整显示保存的请求和“尚未开始”。真实GET /mission及/session返回同一missionID 66393cec906d4d96、sessionID ses_-zUQX2jmmzzvFt8xAveR、code/backlog、原请求，metadata.mission.visibleExpertSquadIDs精确为[base]；关闭后SQLite原持久行也完全对应。不是仅检查前端勾选状态，未调用AI创建或启动执行。

另实际从新对话输入/goal原文并Enter，800-15显示原目标的中文确认表单；点击关闭后800-16主页原文仍在。没有确认运行，后端新增事实仅下面这一份Mission草稿；不将当前入口/取消复核扩大成全Goal生命周期验收。

本批两阶段Provider0、累计993。首次手动shutdown复制模板留下旧端口，精确端口归属检查拒绝；修正两份自有helper分别为38367/38368后重跑原关闭流程成功，未关闭其他实例。两者公开shutdown200，原exec/native/launcher均0、物理/输出/请求三项结算、精确宿主/目标身份已退休；距同一原deadline余量3214170ms/2382710ms。两个自有页关闭，模型目录元数据副本清退，原auth元数据及目录字节/元数据保持。

关闭后原799-after库及基线92表178180行/schema9/integrity ok；候选178233行。全部178180原行逐表精确保留，新增53行经实际关联核验：唯一原草稿Session1，四份session.created/updated原事件及其8份succeeded投递回执、phase/owner与bus_delivery租约/授予事实52，全部沿4个真实occurrence关联同一新Session。原QA7文件、HEAD/分支/6个index条目与index原字节，另3个已记录来源文件字节/mtime，四namespace的17/10/16/24原附件均保持。没有schema或数据格式变更。

没有新增或运行UI自动化，当前检索未发现仓库自有相关UI测试；第三方Kobalte依赖目录自带测试未运行/修改。搜索与保留项来自同一当前请求投影，仍由原用户勾选/上下文/显式安装决定最终选择，不新增持久来源。内置/已安装包原始名称描述保持；市场安装异步回调、不同UI缩放和所有第三方包布局本轮未独立实际验证。16张原图均人工查看，[证据](../../artifacts/2026-10-30-mission-selection-journey/README.md)按实际阅读位置标注，不将过渡图称为完整内容。

当前docs:check已通过（351 ops、26 groups）；方案/证据三索引及当前面板架构同步。提交/推送以Git实际结果报告，不创建版本发布/tag/PR。Goal继续active，未以本批UI选择修复代替旧793工作流历史问题或全产品验收。
