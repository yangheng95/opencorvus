# 当前版本完整产品体验与操作障碍

## Recall

用户纠正：Rendering闪烁早已解决，要求不再围绕旧现象重复调查；原任务是持续改进当前版本UI/UX（界面与体验）、功能完成度、缺陷及必要功能。只用一个编码agent，自主发现、分析、修复、真实体验验证、提交推送；只在无法安全取舍的实际冲突等待。闪烁排查自本记录起关闭，不把旧591未复现结论当作当前待办。保留用户已确定的Goal命令/加号入口，不恢复废弃首页卡片。

开始HEAD1460fb16a，与上游一致。工作区既有其他交付的消息Move、事实核查prompt、Git staging及文档、历史文件删除和两缓存目录保持原样。没有子agent、额外branch/worktree或用户18571进程操作。

已读AGENTS、07-panel现行公开合同、continuous-goal、最近home-launcher-scope/goal-composer-menu/goal-home-hierarchy及其后命令入口决定。全仓定位当前Conversation首页Portal/布局、ChatComposer命令/加号、ContinuousGoalControl、GoalDialogHost、workspace/main导航和现有本地化。旧记录仅用于避免回退用户决定，不据其未完成清单重启旧问题。实际当前版本问题需以本轮页面确认。

## 调查方案与实施前边界

1. 从当前工作区以Node正式构建未加诊断的UI，新空数据/自有项目/独立native开发服务通过`/ui`手工走查。先检查默认首页、Chat/Work/Mission切换、加号与命令Goal表单、项目选择、核心导航/空状态/设置和来源阅读。以真实截图决定当前阻碍，最多选择一组有共同根因的问题实施；不将每个页面扩成独立研究项目，不为已解决问题再跑观察器。
2. 不复制旧用户或QA数据库。凭据如为实际模型验收所需，通过原stageDiagnosticProvider成对准备原OpenAI条目及完整models，先验证凭据/精确Sol投影；正式实际调用全部流式且只允许gpt-6.1-sol，全scope最多12请求（包含后台）。不改变全局用户配置，不把秘密写入spec、日志、prompt或提交。未确认输入前不发模型任务；产品E2E（端到端）如需创建Goal，只创建自有项目中的明确有限目标，不调用其它成员。
3. 找到问题后，在本记录补全可观察现象、触发、根因、旧路径未治原因、定义/调用/公共合同、数据/测试/文档/交付风险，再修改唯一当前实现；不为凑改动加入功能。纯UI只以实际页面操作和截图人工验收，不新增/修改/运行UI自动化测试。遇相关既有UI测试按仓库规则删除，非UI行为用聚焦正向真实合同。
4. 自有native服务20分钟物理边界，提前至少五分钟公开关闭，原caller/reader/native/launcher/输出/request结清再清退副本。前后UI修改需新publication/服务验收；只对自有实例操作。不把服务关闭造成的Offline当新产品问题。
5. 按实际变更完成当前checker、文档/本地化/类型/构建及人工截图复核，三索引和产物README同步，精确范围提交；正常fetch/merge、完整待推集合审查与push。交付重点是修复后的实际操作结果，诊断和截图只保留支持该结论所需的证据。

## 当前页面发现与实施决定

当前普通Node构建main-51aLtQve.js、全新数据、真实54090/ui已走查：首页布局清晰，产品模式/目标选择可用；Mission看板能通过手工表单创建真实草稿，当前不启动执行；Scheduled入口和新建表单正常打开。没有以旧截图预设首页或Goal仍有旧问题。

本轮选中三个当前操作体验问题：

- 定时任务新建时模型与推理强度显示为空。打开模型菜单却实际选中Global default；选择明确GPT-6.1 Sol后模型能显示、默认推理仍为空。直接根因为这两个控件把空字符串作为合法默认选项的optionValue，而安装的Kobalte0.13.11 SelectValue明确将唯一空字符串key视为未选择，显示placeholder；当前renderValue(null)又没有默认文字。不是模型目录或认证缺失。官方[Select文档](https://kobalte.dev/docs/core/components/select)区分选择值与placeholder，与实际源码一致。选项定义、selectedModelOption、selectedReasoningOption、selectModel与submitForm已读，保存使用原providerID/modelID和reasoningEffort，不使用UI key。
- Mission创建说明的示例直接教用户“复核看板数据流、修状态数量”，暴露产品内部实现任务，与普通用户建立长程工作无关。中英两个现行locale键是唯一来源；改为比较方案并交付实施计划的实际工作例子，不改任务语义。
- Mission卡片在标题、项目、需求和更新时间之外直接展示截断的不透明missionID。真实创建截图可见ae2a08563096...，该值不帮助判断下一步且挤占元信息。missionIdentity全仓只有本组件一个使用点，相关span样式只有这一节点使用。保留真实Mission ID、打开/编辑/派发/删除目标、项目、更新时间和Task进度，只从常规卡片正文移除技术ID，并删除失去消费者的函数和样式。

实施为两个选择框各用非空且可逆区分的model:/reasoning:前缀构造局部控件key，原option对象与业务字段保持单一来源；不改共享SelectControl的空值/placeholder语义，不伪造选择文字或改库。横查其它空key调用：Mission的All projects已提供明确placeholder，SelectField的文案由原placeholder控制；没有本轮相同空白证据，不扩大重写公共原语。范围仅ScheduledAutomationsPanel、MissionBoard及其失效样式、两locale文案；API、模型执行、调度/队列、持久数据/schema和迁移均不变。未建立新的调度或终态异常。

已读的scheduled-automations.test.ts是recurrence/HTTP服务合同，不是DOM或组件测试，本轮不运行它来冒充视觉验收；没有新增UI自动化。修改后新正常publication/服务实际复核默认→明确模型/强度→默认、保存与编辑继承字段、中文标签，以及Mission卡片/示例。风险是UI key被错误写入数据或切换后字段丢失，通过真实保存/读取和手工编辑检验。仅清理上述已证明无消费者的UI辅助，不扩张无关技术债。

## 实际修复与体验结果

修复后的正常Node publication为main-xnv1RDfj.js，独立54092/ui使用已关闭before的完整130行数据。英文新建表单明确显示Global default / Model default；选择GPT-6.1 Sol / High后实际保存，日期设为2026-12-31，随后暂停，重新编辑仍为原模型与High。再通过原模型菜单切回Global default、保存、重新打开，两个默认标签均正确保留。切换中文后，已保存详情和编辑表单分别显示全局默认/模型默认，原提示词、日期与时区保持。

关闭后真实SQLite保留三条原生Automation版本：revision1 active/openai/gpt-6.1-sol/high，revision2 paused且配置相同，revision3 paused且三个模型/推理列均null，符合继承默认的当前合同。UI key没有成为持久模型名。唯一automation_fire是2026-12-31T01:00:00Z的未来计划事实，不是本轮执行；两scope实际Provider调用均0，不把表单保存冒充定时执行或模型端到端验收。

中英文Mission创建框实际呈现比较方案/推荐/实施计划示例，卡片仍展示原标题、项目、需求和本地化更新时间。真实点击原卡片编辑请求、修改并保存后，原Mission ae2a08563096bfa2和Session ses_-zUQxLVaezzn1HsDx6z0保持，卡片显示更新后的完整请求开头；没有创建替代Mission。全局新对话首页的`/goal`实际打开原表单并预填目标，关闭后输入保留；加号Continuous goal也打开同一表单，最后取消并清空自有草稿，没有恢复废弃首页卡片或启动目标。

11张精选真实截图由本agent实际呈现并人工查看，见[验收产物](../../artifacts/2026-10-25-current-product-walkthrough/README.md)。截图和实际保存/编辑是UI资格，类型/构建不代替它。Overlay typecheck、i18n（2语言2536键）、CSS token（8874引用/268变量）、renderer公开面及docs:check（350操作/26组）均通过。前后两次正常Node构建分别57秒/80秒，没有诊断插件、UI测试或业务注入。

before/after均公开shutdown200，原exec86571/42265、native/launcher退出0，physical/output/request完整结算，余724143/871100ms；自有页271/272关闭，四份auth/models副本均退休，原认证大小/mtime与目录完整字节/mtime保持。源schema8、92表130原行逐字段保持，目标保留全部原行，仅原Mission Session的pendingPrompt文本及更新时间按真实编辑变化；canonical配置、源字节/mtime和两库integrity保持，目标仍schema8。未操作用户18571、用户库或用户窗口。

本轮限定交付五个生产文件的三项体验修复；旧闪烁调查已按用户最新事实关闭。整体产品迭代继续，不能将当前几个页面的通过扩大为全部功能完成。其它会话的CI、消息Move和营销交付仍各自保留，提交仅含本轮精确文件/索引行，随后按正常上游同步和hook交付。
