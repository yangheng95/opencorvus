# Provider Test 在途变更与作用域资格（持续迭代第14批）

## Recall

用户原始要求：持续迭代opencorvus当前版本直到明确停止，先根因与影响分析并落盘specs，再实现有证据的修复、真实桌面页面交互、截图人工复核、聚焦正向合同、必要且授权的GPT-6.1 Sol端到端验收、范围提交、上游合并及正常推送，自主进入下一批。最新明确要求“停止所有子agent，你自己做并验收”；所有本树子agent已停止，本批完全由Root独立执行，不继续委托或发消息。

第13批范围提交e91191975b61e0b88d5e87e7ba0380804109c77e，parent9a8c1a856759009c0f1f461a3c8a9c51732c5bce、162文件。Root实际84项正向合同/219断言、24原始桌面图、9条真实gpt-6.1-sol流式200/EOF请求；两个完整Auth/models fresh pair分别验证凭据和目标投影，在原进程正常退出后清理；完整原日志的实际凭据扫描0。部分流错误保留已收到文本，两scope默认模型/前置条件/typed Auth错误和原HTTP错误合同已验证。原失败、Saving图及删除确认超时原图均保留并明确边界。

提交自身实际0；外层28608完成56801a1和首reconcile10961完成5d2b491为并发标准index锁，不删锁。改为一次批量精确结算7f5cc60，保留所有peer暂存。推送准备遇到独立Files/长Source阅读交付：46926caf7原图展示、1d07e88a1阅读修复、a71a3ee14恢复被旧索引误带回的33文件、74ff844f6准确记载事故均逐项审阅，未自行改写他人历史。正常hook完整通过，目标74ff844f64c73a76a30df8baca7647a2c3817fa3的release/module检查0（1157 modules/5910 edges/4 clean imports）、secret scan0。首原push15034完成1c7357实际1：远端已并发到同一74ff，expected9a8的ref事务失败；fresh fetch1cd0830、mergefaa1ee0、完整pending空，原normal retry57673仍在进行，不能借其他任务推送自称本次重试0。后续实际结果追加。

持续目标active，不创建branch/worktree，不操作用户窗口/服务、不发布。仍有compaction、真实Provider审计和其他任务改动及独立Git暂存，全部保留。本批只关注Provider Test尚未资格的生命周期，自动ID候选继续保留为后续调查。

已读：B13完整Recall/根因/24原图/公开合同/独立共享机制横审；current architecture05-config、06-provider、07-panel及07-panel-reactivity；当前ProvidersPanel唯一观察Map、Test generation、scope/authority/selection owner、Save/Key/Auth/Delete/refresh及所有调用；llm服务、provider-save、api authority；AuthRoutes、Auth共享写锁与Provider刷新invalidations；B12实际Config/Auth process-lock holder、正常服务启动/停止和假输入运行器；ModelsDev唯一catalog/显式目录校验。全仓Test入口及Task/Mission/Session关联已经在B13横审，本批追加实际现象时继续核对，不把旧EOF事实推广为新执行矩阵。

## 当前证据与未知

已资格：同ID完成结果在Config/Key接受后退休；真实Sol请求received后、EOF前保存全局名称，文件mtime处于两者之间，EOF后原结果未回写；project Test真实200；目标live模型刷新只退休其ID，其他Sol观察保留；registry刷新退休全部；实际全局删除清除自有样例配置/Auth。仅打开编辑和删除确认超时保留原观察，符合未接受变更边界。

尚未资格：不同Provider同时在途、在途Key接受、删除后同ID重建、取消重开/卸载、scope A/B/A及API authority退休、跨作用域延后接受的全局Auth变更、外部窗口/服务改配置传播；完整Task/Mission/Session重启/多项目容量矩阵未实跑。fresh OAuth登录会产生真实外部认证，本批不为没有证据的怀疑更改用户凭据；已有B13真实Sol资格按准确边界保留。

新候选只有源码线索：`AuthRoutes`写入唯一全局Auth，200前已完成原Auth.set和Provider/native-agent cache reset；其当前回执为ok/issues，没有新Provider mutation事件。Panel的接受后退休只在原options.isCurrentDirectory/owns成立时作用于该组件Map。切换设置/项目可卸载该组件，已经开始的物理Auth写入仍可能在新组件读取旧凭据之后接受。此时是否存在现成目录重读/真实事件传播、是否能让旧观察留在当前scope，尚未知。不能从条件检查或最后一个busy状态直接判bug，也不能未确认就新增全局generation、影子凭据缓存或广播合成消息。

## 触发、数据流及影响分析

执行链：真实页Test→当前service捕获scope/authority→两真实route→同operations读取当前配置及有效目录→原Provider语言/认证→单个stream→完整Result/原HTTP error→唯一Map及per-ID generation。LLM（Large Language Model，大语言模型）流保持真实生产路径；测试自身不创建Task/Mission/Session，不以模型自述作为身份或结束证据。

Config写入属于当前project/global声明；Auth属于跨项目全局凭据；canonical catalog也是共享源，live refresh已有实际providers IDs。三种接受事实影响范围不同，不能把同ID或当前pane所有权当成等价语义，也不能以对象引用、源码摘要或时钟造变更事实。已开始写入与随后UI scope退休必须分别观察。

旧方案边界：B12只资格保存观察，B13只资格上述已完成/一个真实在途Config场景；未实跑矩阵不能说已根治所有生命周期。本批首先补实际证据；如观察正确则只记录资格，不为增加改动而重构。若复现跨scope/global共享问题，立即横审全部生产入口、Task/Mission/Session occurrence（执行轮次）、正常终态、重试恢复、串并行和多项目；只有生产代码、持久化事实和实际流证据排除后才能收口为局部UI owner。

公共契约/调用/交付：暂不改变schema、路由、DTO（Data Transfer Object，数据传输对象）、认证存储或SDK（Software Development Kit，软件开发工具包）。任何后续变更先全仓补查定义、caller、同语义和历史，精化此方案再实施。所有产品正文和无障碍名称保持当前中英语言；技术诊断、用户/模型原文保真。不新增/运行UI自动化；业务合同测试和类型/构建不能代替真实页面截图。

## 实施前冻结资格方案

1. B13正常重试实际完成并记录后，启动新的自有开发backend及`/ui`，使用已成功Node构建且Provider区域与当前源一致的冻结UI；不启动独立Vite。只用本批生成的虚构API凭据及合法完整显式catalog，禁止读取、复制或修改用户Auth。受控HTTP参加者仅返回实际有身份的明确错误，保留真实请求body里的model/streaming及接收/回应时间；不伪造模型成功或Message。该参加者只资格故障输入和当前生产/UI路径，不能冒充第三方认证或真实Sol。本批如需要新的真实Sol资格，先另行明确fresh完整pair/target/实际请求及预算，沿原授权运行。
2. Root实际并行启动两个Provider Test，查看两行busy与各自正常错误终态；用已有生产Auth/Config文件锁在自有目录形成可恢复延迟，不浏览器拦截、改DOM或注入app state。只有实际锁ready/HTTP开始后操作；及时明确释放原锁，记录原birth、接受事实、最终流及页面。重建、Key、取消/重挂、scope和authority按独立发生顺序留图，不能用复述或静态源码判定。
3. 专门调查全局Auth延后接受：旧scope已开始保存、物理写锁尚持有时通过真实导航切换新scope，执行新观察，随后释放原锁，核对接受回执、原Auth generation（不保存Key）、目录及真实页面是否自然收敛。锁只是调查故障输入，生产路径不新增gate或流程路由。若具体scope切换会卸载组件，如实记录组件边界，禁止假装同一Map被重用。
4. 已观察异常先落具体根因、影响、排除/未知和唯一实现方案，再修复并回到原输入复验。纯UI不加自动化测试；非UI替代合同必须有聚焦正向明确输出/状态/错误测试。不存在异常时只交付独立验收记录，不扩大无关清理。
5. 所有自有原请求、锁、页面、服务正常settle/join；在实际进程退出/端口释放后清理本批假输入pair并扫描完整原日志。归档原图与原失败，更新specs/README和相关索引/README、当前文档检查；本批所有修改范围提交、fresh upstream merge、完整pending审阅与正常push，然后继续。

## 当前状态

本方案在第14批运行器、生产修改或UI操作前落盘。源码候选与范围已分析；新矩阵运行尚未开始。B13重试原句柄继续观察；未把计划或待返回的命令记为通过。

B13原normal retry57673完成5e8e81实际0，push-retry.exit已确认0，原日志Everything up-to-date、全部正常hooks通过。重试捕获与远端确认的交付头为74ff844f64c73a76a30df8baca7647a2c3817fa3，包含范围e91191975。首远端ref并发拒绝1和最终本任务正常重试0分别承接previous-batch/完整原日志，完整pending首五个已授权审阅、最终空，不合成一个无失败回执。fresh重试fetch1cd0830/mergefaa1ee0才是最终同步；此前pending-review.json里的156f87/284080是上一同步，保原元数据并以本段和原retry日志纠正，不覆盖。
