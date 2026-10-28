# 持续目标暂停、预算与恢复的当前实际体验

## Recall

用户要求持续单代理自主体验、修复、实际验证、范围提交和正常推送，直到明确停止；不委托子代理，不重查已修好的闪烁。上一轮为progress（实际进展）：8e2f28aa3aa592f889471bf0f1b98281caf3b8d2已推送main，2026-10-27T23:48:24Z新fetch/merge为0/0，本任务文件干净，176项外部改动保留。修复归档成功不可见以及Task元数据Bus出版漏入全局列表通知，21个非UI断言通过，8张原图已人工查看；两个实例公开shutdown200及原物理/输出/请求/launcher结清。新目标数据源为已关闭749-after，92表91352行、schema9，原91300行完整保留，模型累计726、复制auth未发生、catalog副本已退休。

GitHub最新真实push提示8项（3 moderate、5 low），尚缺精确告警ID和manifest；上一轮匿名仓库/SBOM200、告警接口401。只读账户授权问题已经发出但未获回复，不重新追问，不使用GitHub账户凭据；该未知不阻断独立产品体验。旧全局Goal的三Astra文字由用户后来多次单代理要求覆盖，整体目标保持active。

本轮先用当前代码验证Goal的暂停、预算保存、明确恢复、累计usage与原身份。不能用2026-10-20旧体验或2026-10-28只创建/自动完成的证据冒充当前完整控制生命周期；不因预期会有bug提前修改。需要真实Provider时沿用用户明确授权复制OpenAI认证、完整模型目录及gpt-6.1-sol端到端请求，秘密内容不得进入日志、规格、prompt或Git。

## 已读与全仓搜索

已读AGENTS、continuous-goal当前架构、ContinuousGoalControl的source/表单/刷新/预算/暂停恢复/冲突分支、Goal服务schema、2026-10-20预算生命周期记录、2026-10-28创建完整旅程、原continuous-goal-check、title-goal-746实际运行/认证审计/退出工具及最新749数据证据。已搜索Goal正式checker、非UI合同测试、全部当前记录入口。benchmark-debug-template技能用于本轮可量化的执行与取证闭环；用户更高优先级的禁止UI自动化要求保持，页面部分只手动交互、截图和人工复核，不套用自动视觉评分。未发现需要删除的相关死代码，不扩大无关清理。

749-after的只读Protocol事件复核显示原三个Goal均已有真实complete事件，不是待恢复目标。新流程须由真实网页建立新Goal和自然消息，保留全部旧身份与事实，不改写旧事件、不制造预算/usage或假终态。已有预算生命周期记录定位了原滚动体/409草稿修复，但不是当前版本的新证据。

## 修改前分析与未知

当前状态预算上限只限制自动继续准入；暂停不撤回已接受工作，保存预算须保留累计usage，明确恢复须追加同一Goal的新revision。UI错误/草稿与scope绑定，既有已设置预算不能用空值清除，耗尽后的active保存须增加剩余额度。这些为当前合同，尚无新缺陷证据。影响面包括Chat/Task/Mission真实owner与Session轮次、请求起点usage归属、API authority/selection替换、模型配置及可读历史。若观察到调度、唤醒、恢复或终态异常，必须立即横审全部生产入口、所有owner与occurrence、正常/终态/重试/重启、串并行和多Project后再定根因。

当前不改公共接口/SDK/OpenAPI、数据格式、迁移、调度或提示词；实际失败后补齐症状、触发点、数据/控制流根因、旧路径遗漏、全仓定义/调用/同语义/合同/数据/测试/文档/交付/风险分析。单纯模型不遵循多轮任务也须保留实际输入/输出，不能通过host路由或硬编码状态机强行让模型走工具流程。

## Benchmark定义与执行方案

- 输入：从真实Home Goal入口创建新会话目标，要求在三个真实会话轮次分别交付本地文档交接说明的范围、核对方式、完成条件；每阶段两句话，不访问网站、不创建Task、不执行命令、不读写业务文件。初始turnBudget=1，tokens不指定。任务在最后完整阶段真实可见后由真实agent自主判断完成，host不指定工具或伪造回复。
- 过程/输出：首轮与第一次自然自动继续后核对真实budget_limited；用户通过UI明确暂停，增加turnBudget并只保存，确认仍暂停/usage保持；再明确恢复，看到同一Goal身份的后续真实自动输入、累计用量和完整交付。若真实模型提前完成或其它状态与条件不符，保留失败，不偷改状态以进入理想路径。
- 环境：新自有goal-lifecycle-750目录，复制已关闭749-after的完整SQLite、durable publication及包revision数据，使用新私有Git Project和当前普通构建main-B03SQ_Ed.js；独立HOME/OPENCORVUS_HOME/端口。只用原开发serve提供/ui，不另起Vite，不操作用户18571、窗口或真实数据库。
- 凭据：复用stageDiagnosticProvider配对复制用户已授权OpenAI认证与完整models.json；分别验证credential可用、实际Provider目录投影的api.id=gpt-6.1-sol、原audit.preflight的真实流式请求完全一致。源不得刷新/交换/写回；副本只在忽略目录，结束后在原进程结清后退休。初次预检和所有helper请求均计入单批最多10次实际请求，累计起点726，重跑不重新分配额度。
- 超时：180秒无实际活动为观测/执行超时；活动只从原请求、工具、进度和输出取得，不以轮询健康检查续期。原native监管40分钟绝对截止仅作物理清理安全寿命，必要重跑沿同一截止，不把启动计时当功能性能结论。通过定时有限快照检查，不持续监听长日志；观察超时不等于终态，仍查看原handle及精确物理事实，禁止因此重复启动。
- 判据：真实UI操作与中英文原截图；原Goal/owner/revision、状态、turnsAccepted、usage关联和原visible controller Message与读取结果一致；原91352行保留（本轮新Goal/新会话只追加对应事实）、schema9和integrity正确；全部真实模型均为指定流式模型，原reader真正EOF后结清，源auth/catalog保持。没有执行的状态/平台/故障不得扩称通过。
- 收尾：公开shutdown、原exec与physical/output/request/launcher全结清后退休认证对；任何修复进入原checker，非UI有聚焦正向合同，UI以实际新发布实页复核。更新三索引、当前docs/architecture、范围commit、fresh上游合并、完整待推集合审查及正常push。无需改动版本时不创建Release/tag/PR。

## 实测根因、影响面与实施决定（生产修改前）

2026-10-28T00:02:57Z的实际Goal pev_g0VZIVmpj00RsyHU58hy属于新私有Project中的Chat ses_-zUQhUDWdzzX0g71aRx5，累计36322 tokens、1个自动轮次、turnBudget=1，状态budget_limited。03-budget-reached-details.jpg实际显示详情只有Save & resume，没有Resume after saving选择，顶部也没有Pause。原请求与输出、全部controller作者和acceptedInput均已保存。

直接触发是budget_limited打开普通Details。ContinuousGoalControl的save()和提交按钮都以resume() OR status=budget_limited强制恢复，复选框又只为paused/blocked显示；因此已有API的显式paused状态在这一入口不可表达。旧路径关注耗尽后恢复的剩余额度校验，遗漏只修改预算而保留不运行的操作；Save & resume已有明确标注，本次不将其误报为隐式执行。全仓三个生产调用点为App的Home/当前owner和SideChatPanel，共用此实现；Chat、Task、Mission沿同一控件。现有后端one exact continuation测试已证明budget_limited→paused→active保留turnsAccepted与递增revision，架构也规定显式paused优先于额度耗尽。无需修改公共API、SDK、OpenAPI、数据库schema9、迁移、调度或自然消息。

实施：budget_limited也提供现有Resume after saving选项；普通Details默认不勾，保存为paused并使用现有pause原因；明确Adjust & resume入口仍由既有changeStatus设置resume=true并显示Save & resume。新增中英文Save without resuming按钮文案，原paused/blocked保留其reason，累计usage、revision冲突、剩余额度和owner lifetime保持。风险为误改直接恢复语义或草稿/locale；以真实页面分别验证两种入口、保存暂停和显式恢复，不增加UI自动化测试。当前改动纯UI，后端既有聚焦正向状态/明确错误合同可独立复核。

原benchmark输入有一处错误假设：Home Goal创建的是目标定义，首个真实输入已是goal-controller的automatic continuation 1，不是先有普通用户会话轮次。原要求“首次输入阶段一、第一次自动继续阶段二”因此实际只得到阶段二。此为验收输入歧义，不以合成用户消息或host路由修正产品。保留原输入/输出与目标身份，在新版验证其可只保存为paused。随后另建明确要求三个自动轮次分别输出阶段一/二/三的新目标，初始预算1，暂停后预算3保存仍paused，再明确恢复直至实际完成；原目标不伪报完成。

原服务90120公开shutdown200，原物理链、输出、请求与launcher全结清exit0；两份自有认证/目录副本已退休，源auth metadata、catalog内容及metadata一致。真实请求3次（全部指定模型、流式、200、reader EOF），本批余7次，累计729。after继续相同40分钟绝对截止，不重置请求额度。数据资源已从两个已关闭私有输入合并复制38项不可变资源，相同资源身份逐字节一致，这是私有验收数据完整性修复，不是产品fallback。

## 实施、失败保留与真实复验

共享控件增加budget_limited的既有恢复复选框；普通详情默认保存paused，明确Adjust & resume仍选中恢复；两种语言的按钮和原有状态/原因同一路径。当前架构同步，schema和应用版本保持9/0.1.33。普通Node/Vite构建与renderer公共面检查exit0，新发布main-BLfBYC1M.js，原页面使用main-B03SQ_Ed.js。

首次非UI测试命令误用了空格形式--test-name-pattern，仓库runner合同要求等号形式；结果目标文件19项/106断言本身通过，但后两个参数被当文件而整个命令exit1。这是本轮调用错误，不伪装产品失败或通过。按当前合同原runner重跑--test-name-pattern=one exact continuation reserves one turn，1项9断言通过、18项过滤、exit0，覆盖真实budget_limited→paused→active与原usage/revision。

after首次私有launcher用全串替换错误地把保留的Project路径指到不存在的after/project；真实DirectoryIntegrityError在预检前拒绝启动，模型请求0。原native/launcher退出1、物理/输出/请求全结清后退休两份副本，保留失败。只修私有launcher参数，另建after2，保持同一绝对截止1793147811385和余7次额度，不复制新Project身份或改旧目标。after2原handle81057、原端口38257、paired预检全部满足后才进入页面。

原目标详情实际显示Save without resuming与未勾复选框；保存后原id保留、revision更新、paused、36322 tokens/1轮不变。新建目标pev_g0VZIYqxL00XXlFpf86N（Chat ses_-zUQhR9QqzzzMZkMj093）使用修正输入：阶段一真实显示后预算耗尽36496/1；先从Adjust & resume看到已勾恢复，取消后只保存为paused；详情预算1→3保存仍paused、usage不变。切换中文后为覆盖中文预算耗尽入口，将预算暂设2并明确恢复：阶段二真实输出，73369/2，budget_limited。中文普通详情默认未勾，显示“保存但不恢复”；额度2→3保存paused/73369/2，中文暂停原因真实持久化；再次明确恢复后第三轮输出阶段三、实际update_continuous_goal完成工具及最终完成回复，complete/148493/3，原id保留。

13张当前原始JPEG均由本代理人工查看；包含两个恢复意图、未勾保存、中英文预算与暂停、三轮交付和完成后证据/累计usage。没有UI自动化、合成消息、host指定工具、用户18571或真实数据库操作。原错误定义目标保留paused，不虚报完成。新Goal从Home自然创建匿名Project，读取其实际URL/directory归属，不拿旧Project查询误判丢失。

两次成功实例公开shutdown200、原handles退出0，失败实例原退出1；三个物理链/输出/请求/launcher均全结清后共退休6份自有auth/catalog文件。实际Provider总10次=before3+failed0+after2的7，全部gpt-6.1-sol/streaming/200/reader EOF，累计736，源catalog内容和metadata、auth metadata保持。未触发第11次尝试，audit.exhausted=false只是表示没有被额度拒绝，不等于还剩额度。after2结清距原截止1285461ms。

## 数据复核的合同纠正

最初逐字节原行保留检查在runtime_execution_capacity_lease发现2行变化，已保留失败和完整差异。横查该表定义、DurableExecutionCapacity.tryAcquire/release和Provider fetch实际生产调用，证实它只存物理准入slot，不拥有Task/Mission/Session的job、重试、顺序或终态。两个原租约在本轮启动前已过期，按同一resource_key/slot带原lease与expiry fence替换为本轮原PID36792/75632的新租约，真实流settled后release把expires_at设为实际释放时间；两行身份未丢失。不是用户数据不兼容、迁移或调度异常，不修改生产容量合同以迎合失当检查。

修正验收明确分开可变租约和业务持久事实：92表/schema9/integrity=ok；91个业务/协议表的全部91349原行精确保留，三个容量slot身份也保留，其中两个按上述合同推进。源749-after仍91352原行完全一致；before与失败after92375行、after2为95070行。本轮没有任何数据库schema升级或原业务行修改。具体计数、过期/获取/释放时间与所属原PID均在数据证据中，而非静态源码断言。

## 当前交付复核与边界

证据目录为[当前生命周期证据](../../artifacts/2026-10-28-goal-control-lifecycle-journey/README.md)，包含13张原始实页截图、7份实际API会话/Goal快照、三个物理退出及副本退休结果、完整数据复核，以及原错误调用和当前聚焦合同/普通构建日志。三索引同步；docs:check为351 ops/26 groups通过，architecture-index为20份当前文档全部链接有效。后续采用独立index只提交本轮文件与三个共享README的本轮行，保留原176项外部改动，正常fetch/merge、检查完整待推集合、运行正常hook并push，不绕过检查。

本轮共享组件真实生命周期验收为Chat，中英文均实操；没有将其扩称Task/Mission/SideChat所有owner、平台和故障恢复都通过。未发布、安装、改版本或触碰用户窗口、18571及用户数据库；GitHub精确告警清单的单独只读授权仍未回复，不使用该凭据也不等待。整体自主迭代目标仍active，本次交付只收敛当前明确的Goal控制体验问题，不将单批完成作为整体停止理由。
