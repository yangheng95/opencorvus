# Git 可执行身份的单次解析与传递

## Recall

492单agent持续自主迭代；用户后续“不用子agent”覆盖长期Goal旧三Astra文字。491为progress：2963e80510616309b75f913560683bde54330c5f已正常提交/push且fresh fetch HEAD=origin/main；十原scope、1776次实际Git、266412计数FS（File System，文件系统）循环/Trace2与源3665行保留。原149目录的完整Config service→HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）保存≤10000ms、整份恢复≤5000ms、四并发读取≤20000ms仍未达。不能用私有scope、组件或截图缩小原验收。

已读491 Recall/原分段数据，GitTimeout/hostGit/executeGit/gitProcessArgs/taskGit、Project.gitRepositoryPaths/discoverGitDirectory/initGit、ProcessSupervisor.resolveWindowsCommandExecutable/whichAsync、Project Git实际行为测试与init-git HTTP文件、原478 writer/readers/启动和完整源快照、Provider.validationCatalog/model-reference-validation/当前架构05-config与task-runtime-directory。全仓hostGit及GitOptions引用/别名搜索共38个源/测试文件，生产hostGit约13个文件；私有gitRepositoryPaths只有discoverGitDirectory调用，两处Project预检查分别是discovery与显式initGit。

开始只有原.bun/与packages/opencorvus/bun/未跟踪；不新建branch/worktree，不动用户18571/进程/数据库。继续使用benchmark-debug-template；不运行UI（User Interface，用户界面）自动化，后端测试只能称后端合同。需要页面时使用授权的内置浏览器隔离页与真实dev CLI /ui，当前正式488 UI未修改。

## 修改前分析与决定

每个现存.git发现先whichAsync("git")确认可用，但丢弃真实路径；随后hostGit的Process Windows准入再次按相同PATH/PATHEXT解析git。显式initGit也相同。单次发现/初始化重复查同一当前工具，并扩大PATH在两次之间变化时的执行选择窗口。491中可执行解析Promise等待中位约31ms包含并行/回调排队，不能当其本体成本或整17秒根因。

修复只传递当次实际which结果：hostGit增加可选第三参数executable，继续由唯一gitProcessArgs/executeGit构造原longPaths/inactivity/输入/错误并交给原Process.runHost；默认调用仍为git。Project发现/初始化把刚解析的路径转换为当前host绝对路径再传递。没有进程/结果/可执行缓存，初始和admitted每次仍新鲜which与真实Git，所有物理全表/注册/删除fence不变。Task adapter不增加host路径选项，不改变胶囊命令或角色工具。

公共影响：hostGit所有原二参调用及函数值传递保留现有输入/默认行为；可选第三参仅为本机已解析工具的值流，不新增配置面、协议、Provider/模型、schema或持久格式。不存在新的备用Git二进制选择。Git不存在仍ProjectGitDiscoveryError(command-unavailable)/400，损坏本地.git仍command-failed，原cause/多命令settle/Windows双行与POSIX（Portable Operating System Interface，便携式操作系统接口）逐标量行为保留。initGit原错误文本保持。

491 Trace2绑定的额外Git层级不能单凭名字作根因。已读官方[Git wrapper当前源码](https://raw.githubusercontent.com/git-for-windows/MINGW-packages/main/mingw-w64-git/git-wrapper.c)：它有环境准备、子进程创建/等待，当前代码也处理无console时CREATE_NO_WINDOW。该main源码不是本机2.45.1的已绑定版本，不能据此猜conhost/Defender或重写用户Git入口；[当前发布说明](https://github.com/git-for-windows/build-extra/blob/main/ReleaseNotes.md)亦表明内部平台目录会变化，cmd入口保持稳定。本轮不重做内部路径、并发/worker、FFI（Foreign Function Interface，外部函数接口）绑定/flags调整，不推广490私有传输。

没有调度/恢复异常的新事实；未改变Host/Task/Mission/Session occurrence（执行轮次）监管、队列、终态、串并行/跨Project。若出现异常立即按共享机制横审所有入口/重试/重启/终态，不归因单一案例。无删除/迁移/不相关清理；私有executeGit既有exactEnv参数本轮不扩展或删除。

## 实施及完整验收方案（启动前）

1. 修改前先在新492自有QA各before/after克隆同一原412的完整149 Project/198 Session/schema3七表3665行与完整canonical（原5键）和对应数据归属；源SQLite只读serialize，不运行其initializer/不修改源库，真实原149目录不缩减。源目录可能由当前实际Project/预检使用；记录真实写入，不把库克隆称整个文件系统克隆。完整canonical wire恢复传递所有原字段，并显式删除本轮新增字段；不复制478旧“只恢复username字段”请求当完整恢复。
2. 固定本批最多4次实际gpt-6.1-sol请求，before/after每scope最多2（包含全部preflight/title/helper），不创建业务Goal/Task或扩额。从当前已授权Codex auth读取仍有效access，不refresh/exchange/写源；新private authority映射完整OpenAI entry并同时复制完整models.json。两runtime分别绑定同一完整对，启动前验证凭据形状/有效期、完整目标模型投影、真实preflight outbound模型和streaming200/source EOF。原所有请求/native/输出结算后完整对退休，源bytes/mtime与实际秘密值扫描记录；若无法使用凭据则如实保留未完成实际Provider资格，不假报模型目录缺失。
3. before实际Source CLI、Bun1.4.0/正式488 UI/446 native，通过原413 owned-host，各20分钟资源边界，端口18863与18865（先检查未占用）。保存/完整恢复从production overlay config service经browser HostTransport到公开HTTP；保留全部149目录/当前完整原canonical和原10s/5s/20s阈值，四读Config/Provider/global providers/真实预检Session均原200/完整目录/Sol投影。无活动90秒为HTTP观察失败；原nativehandle仍必须真实结算，不以观察过期重启。
4. 聚焦新增正向实际Git合同：已解析的真实绝对Git+受限PATH，返回真实Git版本及原root/common两路径；不是“未调用which”的负向计数断言。运行现存project-git-discovery、project Git init HTTP与配置worktree边界相关正向合同（先读清，禁止UI自动化或过期负向核心）。只修改涉及的源码/测试，before服务完全结算后再改生产，避免活跃Source CLI读到新代码。
5. after重新从同一源克隆、同样完整权威对/目录/输入/阈值，原完整checker与四读重跑。实际隔离内置页面查看中英文Home/Goal入口与设置保存期目录，截图人工复核；不宣称此后端改动有新视觉样式。进行适当typecheck/docs和正常推送hook，现有正式UI无变更不为相同内容重建。
6. 所有源与clone原行/字段/rowid/时间/完整恢复、实际请求与原source EOF、public shutdown200、native物理/output/request/launcher及精确出生身份完整结算；保留原失败/不足。不承诺该重复查找改动能单独解决原全部性能目标。生产正确且验证通过可交付独立增量，完整10秒/5秒仍必须按真实结果列为未满足，不改Goal范围。三索引/docs、范围提交、fresh fetch/merge/完整待推集合/正常push；长期Goal active。

## 准备器修复（首次服务启动前）

private authority新鲜完整对已建立、access当前有效、目标catalog存在，0模型。原prepare-data工具60c77f exit1：两clone七表/原canonical资格通过后，Bun1.4.0 copyFileSync对带混合分隔符/..的source路径返回ENOENT；同一输入readFileSync已经成功。独立原d5c51a以path.resolve规范化source和destination执行相同copyFileSync，原完整bytes相同，证明是准备器路径规范化问题，不是源缺失或Provider问题。

只修准备器为同一标准path.resolve/join。原两预备目录确认精确自有根、非reparse、无auth/models和监听器后保留为*-prepare-failed-001，再重跑原完整准备；不删除失败源、不改源库、不启动/重启活跃进程，也没有新模型或业务消息。失败不进入产品启动或性能资格。

before原17866服务已真实预检gpt-6.1-sol/streaming，预算2；其预检会话通过正式匿名Project产生，故clone为原149加1个真实新Project。首checker f7a974原exit1、native/output/request结算：检查器误把预检会话目录当作CLI默认Project，正确后端按目录隔离返回NotFoundError/404。原112939只读SQLite确认真实session.directory，并核对原错误响应；这是检查器选择错误，不是调度/Session归属异常，也没有写配置或额外模型。

修checker从当前clone只读查询实际预检Session目录、先验证公开响应200，再运行原全部149+真实新增1目录与完整保存/恢复/四读取。已结算checker目录精确保留为checker-failed-001后运行新checker，不重启仍活跃的原服务17866，不扩模型配额或造新会话。原错误/准备失败均保留。

## 已实现与首轮完整结果

hostGit只新增可选当前executable参数，Project发现/显式init传入当次which后绝对路径；未缓存、未更换用户Git。原44726正式Bun1.4.0隔离runner exit0：新实际绝对Git/受限PATH/版本/longPaths/物理路径，加现存discovery与init-git HTTP共11 pass/1 POSIX skip；新文件6断言，原两文件14+9断言。后端typecheck66804 exit0。

before原17866服务/修好checker73921均exit0，原公开shutdown200/源reader2次Sol stream200+terminal eof，runtime完整auth/models已按物理证明退休；private authority保留供after，源未写。真实before保存17110.4444/完整恢复16434.472ms，四read≤20秒通过。当前基线保留全部149原目录加1个实际预检匿名Project，原5键完整恢复，不用旧478只恢复username请求。

after原4394服务仍由原20分钟资源边界控制；原78482 checker exit0（功能正常但性能failed）：保存20718.7455/完整恢复18054.9036ms，4读全部200/227Provider/8133投影模型完整，最慢约20821ms超过20秒。不得交付为已提速。实际页面03在目录加载完成、04在配置操作期间、之后仍相同目录；before首页及Goal说明已人工截图。没有新的视觉样式变化。

先前猜测前后UI页面不同可能增加请求，已读取原完整DEBUG窗口排除：before/after每个writer的inventory分别都为150 Project、loaded2/4；正式请求集合相同，额外仅health次数差异，reconcile约0.64—0.72秒。不能把失败归咎于Provider页面或随口说波动。根因仍需匹配复核；原失败组永久保留。

## 匹配控制资格（额外模型预算0，启动前）

为判定安全保留或撤回此次优化，先结束原after页面体验、公开shutdown/原4394完整结算、全部原4/4实际Sol source EOF与runtime pair退休；不热改活跃Source CLI。然后新建两个**无浏览器、无新LLM（Large Language Model，大语言模型）输入/请求**的control-before/control-after独立API（Application Programming Interface，应用程序接口）服务（18867/18869，各4分钟原413 owned-host/446 native），使用同一已结算before库快照（原149加真实预检1、原历史及已完成真实Session）和同一完整原canonical/authority pair。两control各实际模型上限0，保留原总4，不借零调用标签暗增额度。

control-before仅用Bun私有onLoad读取不可变HEAD(2963e8051)的原Project/git两个源文件，解析目录与所有其余当前源码保持；不是分支/worktree、生产备用路径或新二进制选择。control-after用当前两个修改文件。两者均真实当前CLI/HTTP/Config service，全部150实际目录/完整source/四读/原10s/5s/20s，运行期没有页面/测试/typecheck并发干扰。

复用原413隔离启动器的私有副本仅对API-only资格：stage完整当前凭据/catalog、按原角色矩阵验证可用与目标投影，但不调用preflight、不创建Session；写独立api-ready而非假preflight-ready，并明确关联本批已经真实完成的原before Sol证据和同一个authority。RealProviderAudit上限0阻止任何新模型；意外尝试也作为失败保留。新checker按显式资格读取api-ready选择原真实Session，不把别的owner预检伪称新owner请求。两control顺序启动、完整结算后再另一组；相同源物理与原输出/错误合同不弱化。

若匹配控制未显示收益或引入稳定性能损害，撤回本轮生产候选及只服务该候选的新测试/架构描述，保留原实测；只允许精确patch到已证明无用户修改的两个文件，不保留unused新API或另一个实现。若有独立正确性收益但整体性能仍失败，必须清楚说明原完整门槛未达，不把聚焦测试包装成全体完成。任何调度/恢复/终态异常按共享机制全入口横审。

## 匹配结果与生产候选撤回

control-before原2522/9726、control-after原59075/27263服务/checker均exit0；公开shutdown分别b24fcf/0ef6b8返回200，两原服务物理、output、request、launcher完整结算并精确出生身份dead_or_reused，完整runtime auth/models均退休。before-loader原exit清单确认实际加载HEAD 2963e805的两个原模块，不是只准备而未生效。两control原模型预算0/请求0且未耗尽，无新业务Session。

| 完整配置组 | 保存ms | 完整恢复ms | 四读20秒 |
| --- | ---: | ---: | --- |
| 首轮before | 17110.4444 | 16434.4720 | pass |
| 首轮候选after | 20718.7455 | 18054.9036 | fail |
| 无页面control-before | 18999.3559 | 17632.8049 | pass |
| 无页面control-after | 19059.5520 | 20866.6332 | pass |

全部组完整canonical确实恢复、四读HTTP200及完整227 Provider/8133当前投影模型身份一致；原10秒保存/5秒恢复全失败。匹配样本保存没有收益、恢复增加约3.23秒；不能凭单对样本归纳所有机器的稳定回归，但已有证据不支持部署该性能候选。491重复which的存在是代码事实，其收益与整体17—21秒根因并未由实测证明。

先保留withdrawn-candidate.patch与仅服务它的新测试，再按审查的精确差异撤回Project、hostGit和架构段落，删除本轮新测试；git diff确认生产与原HEAD一致。没有保留unused可选API（Application Programming Interface，应用程序接口）、可执行缓存或备用实现。候选期间11 pass/1 POSIX skip和typecheck只能证明该候选局部正确，不包装为性能通过；撤回后没有新的产品契约需要这些测试。

九张人工实际页面包括中英文Home/Goal说明、中文创建表单、Provider目录的配置操作期和恢复后。只打开/取消空Goal表单，无新业务输入；04图片在原writer运行窗口内，具体时间由实际图片mtime与checker起止相交确认，不宣称画面曾显示loading。最终中文Home保持Goal入口与已配置目录；两自有页61/62均关闭，用户18571未操作。这一轮未新增UI样式，亦未把已有完成态图当成新Sources流或Rendering生命周期资格。

收尾按原方案检查源3665行/四clone原字段及完整canonical、schema3/integrity、固定4次真实Sol stream200/source EOF、所有原checker物理结算与秘密值扫描，再退休private authority完整对。归档只含非秘密事实、私有候选/检查脚本与实际图片，不提交DB、完整私人历史、auth或models。长期Goal仍active，原完整配置性能要求未达成。

## 收尾证据

90c7c5原只读保留器exit0：源schema3/integrity ok与全部3665原行/rowid/字段/时间、源bytes/mtime一致；四clone全部原行/完整原canonical准确保留。源授权auth的3929 bytes/mtime、选定access/refresh及完整9155406 bytes catalog与准备事实一致，无refresh/exchange/源写入。

86ff8b原聚合器exit0：四服务、四成功checker及一个原失败checker共九个原native scope，物理/output/request/launcher真实完成，所有原host/target出生身份dead_or_reused。c4ad81实际秘密值扫描exit0：248个自有文本文件/153497041 bytes匹配0，检查真实当前access/refresh/ID/API值而非只搜关键字；四runtime和private authority共五套完整auth/models配对已退休。DB/二进制/图片不属于文本扫描且未归档私人DB。固定实际Sol4/4与两个control0/0，没有新增预算或业务输入。

归档[完整四组事实与九张人工图片](../../artifacts/2026-10-21-git-executable-flow/README.md)及三索引同步；原docs-final 30b3da exit0，345 ops/26 groups。fetch origin 2e407c exit0，当前upstream origin/main。按正常hooks提交推送，生产diff为空；原.bun/与packages/opencorvus/bun/未跟踪文件保留。此记录不宣称性能根因已全部查清或长期Goal完成。
