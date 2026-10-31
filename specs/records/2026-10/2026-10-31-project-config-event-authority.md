# 项目配置事件权威与未发送附件

## Recall

用户要求持续单agent自主调查、先分析落盘、实际UI（User Interface，用户界面）/截图人工复核及必要的真实gpt-6.1-sol端到端验收、范围提交与正常推送。当前单agent要求覆盖旧Goal三Astra文字，本轮不委托。840是progress：2df92b02994bca5a361363911d3553252a32bcb3统一检索/侧栏项目短名，九实图、四真实选择/48目录请求、六纯函数正向测试、正常hooks通过；fresh fetch/普通merge后HEAD=origin/main、0/0。841开始176外部状态私有保存，不覆盖并行文档或无关改动，不建branch/worktree，不重复一次Dependabot重扫，不发布。

最新退休project-search-840-after保存schema9/92表223436行、109保护附件、97 Session/8 Task/757用量，累计1142真实Provider请求。原exec13466/native/launcher0、shutdown200、物理/输出/请求/OS（Operating System，操作系统）出生链结清，两配对副本已退休、源保持。839原来源23/25文件及21原件仍完整；跨origin未提交副本按现60秒GC（Garbage Collection，垃圾回收）合同已回收，不重传或合成引用凑持久化。十三旧Git项目28 tracked、十三+三十九原文件及833/836/837/838/839事实继续保护。用户18571真实服务、数据库、窗口、进程及其他用户页面不操作。

已读ConfigRoutes PATCH/config、Config.writeProjectPatch/resetProjectState/prepareProjectRuntimeTransition/peer调和，ChatComposer并行度控件和patchConfig、Session模型owner及patchSessionConfig，项目打开sweep、当前02/05/07架构，Session.Event.ConfigChanged、protocol session-mirror/SessionProtocolEventType、GlobalBus/BusEvent.payloads、GET/global/event声明及生成SDK。全仓搜全部config.changed生产定义/调用、消费者和相关测试：Project配置producer一处，Session producer和Task/Session mirror保留，Memory organizer分别订阅本地Session和全局Project信号。当前没有发现UI自动化，不新增或运行。

## 深度、根因候选与影响

原调查问题是未发送附件超过GC宽限后，项目设置保存是否误触发实例重建/回收。源码显示项目配置按当前Project identity原地reset配置cache、调和MCP（Model Context Protocol，模型上下文协议）/Provider/registry/channel并发布事件，没有Instance.dispose或重新bootstrap；因此附件失效尚未成立，需要真实流程，不先改GC或附件寿命。

已经查到的公共契约冲突：Config的Project/global-peer调和经GlobalBus发布type=config.changed、properties=effective Config.Info；Session.Event.ConfigChanged注册同一个type，却只声明{sessionID}，Session mirror和前端selected stream亦将它严格视为Session事实。GET/global/event明确声明payload=BusEvent.payloads()，SDK（Software Development Kit，软件开发工具包）EventConfigChanged要求sessionID，所以真实Project配置事件与公开union不一致。GlobalBus的payload:any让这个冲突绕过类型检查。现代码证据足够提出修复方向，但实施前仍须捕获真实公开事件进入同一BusEvent checker（检查器）的失败输出，不能用命名或模型自述替代。

旧Session模型投影修复要求config.changed携带精确Session，防止用项目默认值覆盖所选模型；给这个分支加缺字段fallback或按字段猜两种消息会重建双源。拟保留现Session/Task协议与全部持久历史的config.changed，给Project的现producer建立唯一typed project.config.changed，properties直接为现Config.Info；Memory organizer和Project配置相关监听改读新canonical（规范）事件。Session/Task mirror不改，不迁移历史。若实际UI消费Project信号，还应按真实stream与directory authority显式处理，不能弱化Session校验或把未知事件吞成成功。

横向影响审计覆盖本地Project PATCH、loaded-project peer/global变更、调和成功/提交后失败与重试/重启恢复、并行和多项目目录；Session模型变更、Task root镜像、Chat/Work/Mission Session及其持久event occurrence（执行轮次）维持独立。Memory organizer有Session本地与Project全局两个入口，同名可能跨权威触发；是否造成重复调度未知，须以其事务/运行事实判断。若发现调度、队列、唤醒、恢复、并发或终态异常，立即横审全部生产Task/Mission/Session轮次和正常/终态/重试/恢复/串并行/多项目，不据单用例缩小。

预计范围为Config typed事件、Project memory监听、相关真实后端正向测试/fixture、OpenAPI（开放接口规范）与生成SDK及当前05/07合同。除非真实页面证据要求，前端Session投影和UI不改。每个改动前保存当前差异，源路径若有外部改动先核实边界。现触及测试若有核心负向断言，按当前正向输出/命名错误契约修复或删除，不为旧测试保留旧信号。没有schema/持久数据格式、模型调用模式、配置字段或版本变化；所有LLM（Large Language Model，大语言模型）调用继续流式。

## 实施前真实方案

完整续存已退休840-after到staged-attachment-reload-841-before/38472，冻结main-Rn-pJKfx.js。首启新的60分钟绝对deadline，候选after/38473共用、不延期，至少五分钟结清余量。仅native开发serve /ui和自有隐藏内置页，不单开Vite。授权auth与完整models配对复制，启动分别验证OAuth（开放授权）及精确gpt-6.1-sol投影；before最多8实际流式请求、需要修复时after最多8、整批最多16，所有辅助请求计入，累计最高1158，不因观察超时重启或扩额。凭据不进入prompt、日志、spec或提交。

真实New chat选Code/Chat与明确模型，发送可见预检只回复PREFLIGHT_841_BEFORE_OK，先证明实际模型/streaming/200/reader EOF（End of File，流正常结束）。同一新QA（Quality Assurance，质量验证）Project/Session上传自有三行staged-note.txt，填入要求实际read、仅按原文给出CHECKPOINT与COUNT并保留真实Sources的草稿，提示不泄露文件预期值。不写文件、联网、建Task/其他会话/子agent或委派。

自然经过至少65秒（按实际blob mtime计算，不改mtime造龄），期间核对真实输入/原件、配置与owner；长等待用不超过30秒的定时唤醒，不持续tail日志。通过实际More→Parallel slider把当前5降为4，保存原项目配置。真实API（Application Programming Interface，应用程序编程接口）响应、配置文件、原草稿/附件及Session模型均核对；同一目录另一个有限SSE（Server-Sent Events，服务器推送事件）reader读取GET/global/event，把实际Project事件送入BusEvent.payloads().safeParse。只保留type、directory、属性key、max_executor_groups、typed issues路径/代码，绝不记录完整配置或凭据值。reader独立300秒上限、原句柄和abort/退出结清；基线schema拒绝以实际checker exit1如实保留，不让诊断监听器抛错改变产品保存结果。

保存后核对真实canonical HTTP原件200/字节，再经真实UI发送现草稿，确认模型实际read、原字段/来源与同一Session/Project，完整消息和请求审计。检查实际浏览器错误，区分Project全局流与Session/Task选中流，不把一个stream的行为外推全部stream。若事件schema冲突确实出现，补证据后实施typed Project事件、全部消费者/当前合同与SDK生成；聚焦正向后端checker、类型/必要构建通过后，after新自然QA对话复跑完整流程，原失败历史与所有数据续存。

旧92表逐列和109附件、旧文件/Git/完整公开历史/Goal/Sources/paused计划保护；旧容量槽仅允许真实过期租约在当前native PID（Process Identifier，进程标识）下复用四字段并物理释放。新QA消息/用量/配置/事件按实际记录。自有页先关、public shutdown200、原exec/native/launcher0及物理/输出/请求/出生链后退休配对副本，源保持。同步方案/产物/三索引和docs检查；范围commit、每次push前fresh fetch/普通merge/待推全集审查/必要验证、正常hooks push，保留其他工作区改动，长期Goal仍active。

## 实测基线与最终实施边界

38472/main-Rn-pJKfx.js，自有页38真实Code/Chat明确GPT-6.1 Sol；预检得到PREFLIGHT_841_BEFORE_OK，两请求均stream/200/EOF。新Session ses_-zUQMfHL6zzIM2xF4t0q、Project prj_hwH4r6IW4X8F2cuEEBBe。真实选择54字节三行TXT并填写原文读取草稿，上传后自然等待超过65秒；真实More→Parallel slider通过键盘Left从5保存为4，实际PATCH/config返回200，原草稿/附件及模型保留。实际原件回读时age119242毫秒、HTTP200/54原字节；没有附件GC失效。

有限独立GET/global/event reader（原exec34896、PID11064）捕获该实际保存产生的config.changed、assistant.max_executor_groups=4，BusEvent.payloads checker明确拒绝：schema-error，issues路径properties.sessionID/code invalid_type，HTTP流本身200。reader正常cancel/abort/drain，原进程exit1为被测契约红灯，不是观察超时或产品API保存失败；日志只存allowlisted属性名/计数，没有完整配置。浏览器error/warn诊断计数0，未观察到Project全局事件进入选中Session UI分支；不能因此把API声明冲突降级或虚构UI错误。

随后真实发送保留的草稿，模型实际read完成，五自然消息，回复CHECKPOINT=CEDAR_841/COUNT=37且Sources对应原件；05/06已亲自查看模型结果及只读原来源。共5真实请求（含辅助）、全部gpt-6.1-sol stream/200/EOF、exhausted=false，累计1147，余3额度退休；候选仍最多8，整批最大13实际请求低于原16上限，不追加。新项目10文件含单一.opencorvus/opencorvus.jsonc，所有内容按实际记录，未指挥模型写配置。

实施确定为Config.Event.ProjectChanged注册project.config.changed、properties=Config.Info，现Project本地/peer/global调和producer读此定义；Project memory全局listener和相关Project配置用例读新定义，当前05合同/SDK同步。Session.Event.ConfigChanged、Task/Session持久enum/mirror和前端严格Session投影均保持现规范，没有旧Project信号兼容层、按字段猜权威或关闭GC。重点正向checker验证真实项目写入事件可由公共union解析，原Session事件仍由原镜像正确投影；现触及MCP用例中一个负向generation匹配改为当前Instance/durable generation及实际凭据的正向结果。

十个拟修改tracked文件均在本轮起点干净，原字节及差异已私有保存（diff0）；生成SDK前还须保存完整现生成面。基线页38关闭，public shutdown200，原exec2853/native/launcher0，物理/输出/请求/出生链结清再退休配对副本，源保持，余3207055毫秒。旧92表223436行所有业务字段保持，当前224870只新增本轮实际Project/Session/消息/用量/记忆/事件/正常租约；两过期容量槽仅四字段在当前native PID复用并释放。109附件及原文件/Git保持，schema9未变。

## 实施与候选验收

已落地单一 Config.Event.ProjectChanged；全仓复搜确认剩余 config.changed 均为原 Session/Task 定义、持久协议与前端精确 Session 投影。Memory organizer 的全局 Project 入口与本地 Session 入口各读自身定义，Project peer/global/credential 恢复测试和子进程 fixture 同步。当前 05 合同同步，07-panel/07-panel-reactivity 没有对应同名 Project 声明，无须无关修改。

新增正向后端用例通过真实 Config.updateProjectPatch 捕获并解析生产 GlobalBus 事件。初次断言误把保存接口的稀疏声明当作有效配置，checker 明确显示差异后改为 await Config.get() 的现合同；单独重跑两用例通过，并正在完整重跑原七文件验收。初轮其余六文件已全部通过，包括九个跨进程收敛、MCP 写入失败/后继进程恢复、Project Memory 多项目身份路由与 Task root Session 镜像。

生成前完整保存 SDK gen/defaults/OpenAPI，初始均干净。正式 SDK build exit0，只产生 EventProjectConfigChanged 与公开 union/schema 共两文件25行新增，properties 引用唯一 Config。后端与 Overlay 类型检查均 exit0；普通 Overlay build 与 renderer public surface exit0，产物仍 main-Rn-pJKfx.js，未执行 build:overlay 或升级真实数据库。初次 module topology 检查的是并行文档提交 HEAD，只作为基线；最终 push hook 将检查本轮提交的 exact treeish。

候选38473从已退休基线224870行续存，保护附件115（原109加基线发布的六个附件文件），新页39、native PID6756。启动分别确认配对 OAuth 与完整目录精确模型投影；真实 Code/Chat 明选模型，预检 PREFLIGHT_841_AFTER_OK，两请求均 gpt-6.1-sol/stream/200/EOF。新 Session ses_-zUQMb34Ozzn5eMNm1vh、Project prj_hm3AG07ZoLDLvimiVLb0。07/08截图已亲自查看，原件54字节、设置5、同一读取草稿保留。有限公开 SSE reader 原exec28878/PID29480已连接HTTP200，等待同一自然龄附件后的实际保存；沿用原绝对deadline不延长。

### 原验收失败、工具修复与最终结果

候选自然龄77280毫秒后，真实 slider Left 保存5→4，实际原件回读age103213毫秒、HTTP200/54原字节、有效配置4。初次候选 observer 捕获新 project.config.changed，但 Config.Info 在 properties.mcp.browser.command 拒绝：检查进程使用595的 Bun，而 producer 使用本轮 bundle 的 Bun。BrowserMCPBuiltin.command/isBuiltinLocalConfig 按 process.execPath 严格验证内置身份；这个 custom refinement 无法跨不同 executable identity 校验，和原基线缺 sessionID 是不同原因。保留原exec28878/exit1与脱敏结果，不把它冒充通过、不放松生产 schema。有限 exact observer 使用同一 producer executable，入口先断言该事实，真实 UI 同一草稿再保存4→5→4；原exec97339/PID8000捕获实际新事件，生产 BusEvent checker valid、exit0，reader cancel/abort/drain结清。没有重启模型服务或追加 Provider 额度。

完整七文件第一次重跑还发现自有 config-tests-final 环境嵌套使 MCP setup 项目路径达到252字符，Git init 返回0但 discovery 128；四个子进程用例在 recovery 之前失败，并非调度终态异常。独立自有原长路径仓库重现同样128，core.longpaths=true 仍128；同一仓库原件复制到30字符目录后 discovery0，排除配置事件和凭据恢复根因。仅缩短自有运行器标签为 cf，不改生产 Git 合同、不用负向用例或重试掩盖。重新进入原 run-tests.ts、原七文件全部完成：2/9/4/12/5/25/1，共58正向用例，exit0；失败两轮与物理结清证据仍保留。MCP 五用例包括真实后继进程恢复与双 warm backend 竞争，Project Memory 覆盖多项目路由、lease 重试和配置 barrier，Task root Session mirror 保持原输出。

实际发送原草稿后得到五自然消息、一个 completed read、正确 CHECKPOINT=CEDAR_841/COUNT=37。Sources 打开原三行只读文件，英文及中文的来源、附件、只读、日期、空闲状态/发送控件已亲自查看11/12/13截图；中文 Sources: 属于模型原文，保持原事实。浏览器warn/error计数0仅作诊断，十三截图才是视觉证据。候选5请求、整批10、累计1152，全部精确模型gpt-6.1-sol/stream/200/EOF、exhausted=false；两scope各余3额度退休。

八组原真实HTTP checker全部通过：Task68/Mission80/Chat3/Work8完整原历史与Goal，旧Sources4/3消息、README176字节原件、824六消息双来源、825两/四消息、空历史原选择及22文件、额外预检2消息/Goal9消息242063 token/39原件、两暂停计划及三命名原件全部保持。额外核对本轮基线五自然消息、selection与canonical TXT HTTP200/54原字节完全一致。所有检查均真实公开路径或原数据比较，不是UI自动化。

页39已关闭，shutdown HTTP200，原exec96661/native6756/launcher0；settle确认物理/输出/请求/出生链后退休auth/models配对副本，源auth metadata与catalog字节/metadata保持。余2030943毫秒，早于原deadline五分钟结清要求。schema9/92表保持，原224870行所有业务字段保持，当前226303；新本轮Project/Session/五消息/十二part/一次read与五用量正常增加，两原过期容量槽仅当前native复用四字段并物理释放。115附件、十三旧Git项目28 tracked、十三+三十九原件及833/836/837/838/839数据均保持。没有生产用户数据库升级、版本更新或发布。

### 交付检查

生成面、源代码、测试、架构、方案与产物纳入本轮范围，三共享索引只加入本轮一行并保留并行正文。并行2ab8aa26e17d为182文件且全部specs，不涉及生产源，本轮不等待。随后执行docs检查、范围提交、fresh fetch/普通merge/待推全集审查和正常push hooks；最终远端收敛结果在交付回执记录，长期Goal继续active。
