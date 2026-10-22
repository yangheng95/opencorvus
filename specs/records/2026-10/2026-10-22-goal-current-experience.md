# Goal 当前页面交互复核

## Recall

523按用户“内置浏览器调试”、Goal使用不可见与默认页布局反馈继续单agent；不委托。522原生增量输出私有资格已提交4676cd0b4，正常push原57881尚在hooks中，必须join及fresh远端核验，不重启或绕过。开始只原.bun/、packages/opencorvus/bun/未跟踪。当前UI实际最近生产改动为515，513已修首页信息层级；本轮先真实查看当前实现，不能重复把旧图当现状。长期目标继续，未达10/5秒配置性能目标另有证据，不以本轮UI观察替代。

## 修改前分析与搜索

已读513 Recall/结果/真实图索引、ContinuousGoalControl源的owner/home/表单生命周期、shared Dialog调用、continuous-goal样式、App首页挂载、Conversation Portal/示例、当前07-panel架构目录、overlay命令；搜索当前overlay提交、所有Goal相关文件与生产首页挂载。513现行顺序为标题、输入、示例、独立持续目标区，入口、用途、预算提示与“如何使用”已有实现，不能宣称缺失。已读513的隔离准备、开发CLI、物理关闭与完整保留脚本；当前515正式UI包仍是现行source版本。

潜在影响为首页与Goal表单的视觉/交互、本地化及无障碍；实际问题、直接触发、数据流根因需以下真实截图再确认。API、模型、owner、schema、持久化/调度不计划改动；若发现此类异常，先按全部共享入口横审，不以单例归因。public协议/定义/调用及历史决策必须在拟改前补搜索。尚未观察新故障，不能先写修复。

## 实施前方案与边界

1. 使用内置浏览器已绑定ID2，只新建自有隔离标签；不刷新/关闭用户18571、窗口或服务。复用已审查513脚本但创建全新goal-current-experience-523 before19001/after19003范围，开发模式Source CLI提供/ui。只读已物理关闭512 historical完整schema3数据库及canonical配置，完整复制原字段/时间；冻结Bun1.4.0及原413/446宿主，模型预算0、无auth/catalog副本。20分钟原宿主范围，观察超时不当物理终态。
2. 先实际截图首页/Goal创建/指南、从真实草稿进入、关闭后草稿、较窄桌面、语言切换与键盘操作；只人工真实交互/截图复核。禁止任何UI自动化测试、DOM断言、快照或像素基线。DOM只可读用于理解当下页面，不注入隐藏状态。没有新Provider端到端资格，原真实执行证据保持其原范围。
3. 找到真实问题后先补代码/数据流根因、全仓调用点与最小唯一方案，再修改；用现有组件/token与双语文案。若需要改UI，在新after范围正式Node构建、实际页面重新截图；不以typecheck/build替代视觉。若当前流程已正常，记录实际边界并继续其他可观察问题，不制造功能或伪消息。
4. 公开shutdown200、原exec/native/output/request/launcher及精确PID/birth终态、0模型审计、全部原表行与canonical保留；精选截图/非秘密工具事实归档、三索引、docs/architecture与实际秘密扫描；范围提交、fresh fetch/merge、完整pending集合审查、正常push/fresh一致。

## 真实复现与修改前根因补充

before19001原36568/IAB116，01当前首页、02创建表单均已截图查看，现行入口和说明真实可见。实际在新建表单填写`Improve the onboarding flow and verify the finished page.`、token10000、turn3，点击Close再Create continuous goal，03图显示三项都清空，预算重回No limit。未点击提交、模型审计额度0。该现象是关闭未提交草稿的问题，不是模型或调度故障。

直接触发是ContinuousGoalControl.open每次create都从composerDraftText重置objective，并将tokens/turns置空；About也走同一reset段。现有461修复解决从聊天输入的handoff和关闭时原composer保留，513解决首页层级，均没有保留仅在表单编辑的字段。全仓当前挂载只有App的home/owner和SideChat，同一组件独立实例、各自composer key；main/App创建上下文和source包含真实authority/selection/owner，公开create/mutate协议无需修改。current continuous-goal架构已声明关闭保持草稿，但缺少此modal字段范围。

最小唯一方案：继续用现有objective/tokens/turns信号作为唯一表单字段；扩展原createDraft的上下文快照，按API revision、selection epoch、真实owner/source、composer key和原输入文本辨别同一未提交草稿。同scope重新打开不覆盖三字段，About仅切换说明视图；新scope/原composer输入变化/成功创建仍初始化或退休，保持原idempotency、mutation和已有composer成功清理。不会把表单编辑反写聊天草稿，不新增持久化、另一套缓存/表单、fallback或模型消息。已有source切换effect继续退休快照；home即使source为空也用authority/selection保护。当前UI源码无未提交用户差异，修改前已核对。

## 实际实施、视觉复验与边界

仅改共享ContinuousGoalControl初始化：原字段信号继续唯一持有当前表单值，createDraft增加scope身份；同scope create保留，About保留，details/complete仍投影真实goal，新source/成功创建退休。可选composer key仍只在存在时参与原成功消费。三个真实挂载点共用同一实现，未改API/schema/调度/模型或消息。current continuous-goal架构同时修正此前遗留的“无边框、Goal在示例前”旧描述，与513已交付的单一首页布局事实一致。

after正式Node构建原20561 exit0，7313模块/70秒，实际main-Dp2CjRPP.js；Overlay typecheck、i18n（2语言2529键）及CSS token（8879引用/268token）原11857 exit0。依赖use-client/共享静动态引用/大chunk提示保留；未以其或无console错误代替视觉。Source CLI before原36568/19001、after原92769/19003及IAB116/117，14张原图全部实际呈现并人工查看：

- 04相同英文目标/10000/3，Close重开仍完整；05真实指南、06经How it works/Escape后重开仍完整。
- 07真实聊天输入改为中文新正文，新表单正确预填该正文并显示初始空预算；此前英文modal编辑没有写回聊天输入。
- 08实际语言切换后中文首页；09中文目标/12000/4，经Escape重开完整保留。08有真实设置悬浮提示，不作最终主图。
- 10真实拖动左栏280→493，中文标题/输入/示例/目标正文、创建、说明和预算提示完整可读可点，随后恢复280；这是较窄桌面工作区，不是移动端/右dock验证。
- 11选择已有真实Chat，独立表单初始空；填写另一目标/9000/2，Close重开仍保留。该只读历史会话因没有模型目录显示真实模型配置提示，未触发模型请求或创建Goal。
- 12返回新首页有实际导航tooltip；13新Home表单从当前空composer初始化；关闭后14最终干净中文首页，完整信息顺序和入口已查看。全部自有验收输入已清除，没有提交目标、创建消息或新业务owner。

工具过程保留：首次after准备在before尚未关闭时被读取原physical-terminal文件检查阻止（ENOENT），没有创建after或启动第二服务；随后关闭IAB116、公开shutdown200、join原36568并完成精确物理结算，再准备after。没有跳过该安全依赖、覆写运行范围或重启活跃服务。一次PowerShell `$LASTEXITCODE`空值导致后续命令未执行，实际分开执行并保留原工具exit；正式构建原20561已join0。

两个原服务均公开shutdown200、原36568/92769 exit0；native physical/output/request完成、launcher0及精确host/target dead_or_reused，两个IAB页已关闭。实际Provider audit maximum0/actual0/exhausted=false，无auth/models副本。完整保留检查exit0：两范围各90表156566原行、schema3、全部原字段/时间无差异，源DB bytes/mtime和完整canonical配置保持，provider_activity_request仍391/391。用户18571页面/进程/真实数据库未操作；当前构建仅资产输出，不加载数据库。

本批未覆盖新Goal提交/成功后的模型执行、预算调度、SideChat真实表单、认证传输故障或连续帧Rendering，亦未证明重载页面/组件销毁后持久草稿；当前实现明确仅当前组件未提交草稿的同上下文保留。没有新UI自动化测试；当前触及代码与搜索命中未发现UI测试需删除。docs/architecture与最终安全/Git结果见产物；长期Goal保持active，配置10/5秒及原型公开合同缺口保持原未达成状态。

最终当前docs:check通过345 ops/26 groups，architecture-index通过20文档，diff check通过；当前产物含解压构建日志、源组件、架构、record与三索引的实际凭据值扫描0匹配，原auth bytes/mtime保持。仅此组件、当前契约和当前批次spec/产物进入提交；原两未跟踪缓存保留。Git交付继续使用当前main正常commit、fresh fetch/merge与完整pending审查、正常hook push及fresh远端一致，不创建发布。
