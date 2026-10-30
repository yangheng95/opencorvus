# 对话原消息定位的请求归属

## Recall

用户要求持续单agent自主体验、根因分析后落盘、实际页面和截图人工复核、范围提交、拉取合并上游后正常推送；只在实际无法安全取舍的冲突等待。最新单agent要求覆盖长期Goal旧的三个Astra，本批不委托。用户18571服务、窗口、进程和真实数据库不操作，不新建branch/worktree、不重写历史或跳过hooks。OpenAI隔离认证与完整模型目录复制授权继续有效，本批只读界面验收，gpt-6.1-sol模型上限0；不执行历史指令。Dependabot一次重扫已消耗，不重复。

上一轮是progress：d67e992fd1a995d06ffdc12f7c05cb3a676a5e54已交付Task/Mission完整历史查找、参与者原文定位和逐消息停止归属；17个纯数据测试、28图人工复核、构建/类型/i18n/docs与正常hooks通过。05:19:25.828Z fresh fetch/merge HEAD=origin/main=23dc97f2f83f8fbe614d61015a20652235ec0377、0/0，本批文件无未提交修改。依赖/发布日志两个已授权并验证通过的提交也已同步；告警32在05:13:49Z自动fixed。其他会话持续处理发布和benchmark，本批不改版本族、CHANGELOG、依赖、发布配置或其记录，不启动发布。

已读当前AGENTS、07-panel-reactivity、807 Recall/终态、SubagentConversationPanel完整resource/reading/navigation代码、conversation-scroll全部定义/调用、主Conversation和AgentRail入口、查找Dialog、conversation快照/旧页/实时发布点、共享animation-frame scheduler和子会话refresh队列。全仓搜索确认滚动生产者为查找、AgentRail、主阅读恢复、主到子侧栏交接；消费者为主VirtualizedConversationCards及当前SubagentConversationPanel两个surface。触及生产文件当前干净。

## 修改前分析

父级navigation保存request/target/resolve。resource loading或displayedConversation更新会重新运行effect并schedule。共享animation-frame scheduler只合并尚未开始的帧，执行前清空frame；导航返回的Promise尚在等待布局稳定时，后续真实更新可再次进入同一navigateMessage。子reader的navigationRevision会重建同一reader，旧恢复cleanup可以返回false，使同一查找提前错误结束。807的终态数据验收未覆盖这种进行中的重复交接。控制流由代码确认；实时交错导致的确定性实页复现仍未知，不能写成已复现。

现有target key包含authority、源类型/ID、目录和子Session；源变化、初次读取失败、原Message移除和组件cleanup会完成当前请求为false，异步回调还比对原pending对象和当前target。子reader从唯一原resource读取，唯一setupAutoScroll负责message run与稳定布局，阅读记录沿当前store。不能用延迟、调低刷新频率、重试、过滤结果或另一个滚动writer掩盖重复交接。

方案让pending持有第一次真实landing Promise作为唯一进行中操作。帧回调仅在尚无landing时启动；内容更新仍沿原resource/投影、身份和成员校验，不重启已有定位。原Promise结果、拒绝、来源退休和关闭路径收敛原请求。不增加持久状态、第二份消息、API、SDK、schema或LLM控制流；公共滚动请求及其他入口卡片语义保持，文案和语言键不变。

## 共享机制横向核对

- Task、Mission、Chat、Work由同一标题Dialog进入，原source/selection epoch/authority/目录owner退休旧请求；成员进入同一子surface，主消息由主reader定位，不按专家团或标题分支。
- AgentRail普通卡片导航、主阅读恢复和无messageID请求不创建子消息landing，只复核原主滚动owner，不增加第二writer。
- 子侧栏首次读取、正常实时更新、刷新、失败重试、终态原历史、关闭/重开、换成员/换源/换Project共用requestKey/resource；每次新用户导航有新的Promise，旧结果只可处理原pending对象。
- 两个surface均无持久导航队列，重启/刷新沿已有阅读记录恢复，不恢复悬空Promise。Task/Mission/Session执行轮次、业务调度/唤醒/重试没有入口或状态修改；以模型0、真实公开GET、SQL业务行保持和startup recovery=0继续核对。发现真实执行异常即扩展业务共享机制审计，不能以UI范围降级。

## 实施前验收方案

1. 源为完全退休807b-verified。原生SQLite backup保留204863行、92表/schema9，75附件/六namespace、7项目25tracked及Git事实。新808-before38394/after38395共用首次启动固定60分钟截止，至少提前5分钟完成退出。短检查沿原isolated runner；服务按物理进程寿命，不按日志安静推断死亡。认证和完整models仅原启动配对复制，0模型上限/累计1083。
2. 从当前HEAD和已安装补丁依赖构建、冻结before静态包，再启动项目开发服务，通过localhost:<port>/ui在独立后台页查看真实Task68及两个参与者、Mission80、Chat3、Work8。保留当前实页/HTTP，不能把旧807包当当前版本，也不能在构建未完成时继续启动。
3. 修改私有UI请求owner后构建/类型检查，冻结after包并复核同消息定位、连续查询、换成员、关闭/重开侧栏、Escape和其他会话查找。只用实页交互/截图人工验收，不新增、修改或运行UI自动化、源码文案、组件/DOM或快照测试。这是UI owner变更，没有非UI公共接口变更；纯数据测试不冒充实时竞态端到端。
4. 若无自然实时交错或超过80条历史，明确保留未验收边界；不注入事件、延迟响应、伪造消息或模型循环凑数量。原库查询证明最大Session80、最大Task68，无数据覆盖不能说通过。
5. 所有自有页关闭，公开shutdown200、原exec/native/launcher0、物理/输出/请求/出生身份结清，配对副本退休，源认证metadata及catalog字节保持。原生SQL EXCEPT精确保留全部原业务值/计数，附件/项目原字节/Git保持。同步当前架构、三索引和产物，当前docs检查、范围提交、fresh fetch/merge、完整待推集合复核、正常hooks push/fresh回读。Goal保持active。

## 当前版本实页与实施决定

before使用本轮真实构建main-CLa0Hodj.js（已安装Vite6.4.5/Seroval1.6.11），完整公开HTTP保持Task68/Mission80/Chat3/Work8及Goal complete/148493/3。本人查看01/02两图，Builder与Generalist正常原文定位通过，没有在终态数据中重现实时交错错误。随后自有页面关闭、公开shutdown200、原exec/native/launcher0、物理/输出/请求结清，配对副本退休；剩余期限见原退出回执。实施只在pending上保留第一次真实landing Promise，并在其拒绝时收敛同一原请求。它是实际进行中操作，未增加独立状态位或重复消息；原source/Message存在性校验继续处理内容更新，Promise身份检查保留。不会把正常before图片写成失败复现。

## 实页结果及数据复核

after构建main-frUcynBE.js和类型检查实际通过。本人查看03–08：Builder原文定位、关闭侧栏后新查询重开Generalist、通过真实侧栏跨Project切换Chat并定位原回复、继续切换Mission/Work并定位其原消息，以及菜单查找输入后Escape关闭并返回原按钮180，均通过。新Chat查找显示3条、Mission80条、Work8条和4条阶段三结果，Goal保持complete。侧栏切换期间临时loading不当失败或完整验收，稳定截图才作结果；主验收页warn/error为空。

before/after实页前后四类selection/full transcript/hydration/Goal完整公开HTTP响应逐值一致。原生SQLite EXCEPT保留204863条原值（含TEXT/BLOB）、92表/schema9；before204865、after204867，唯一增加两组runtime activation lease/grant，全部业务计数保持。75附件六namespace源/副本、7项目25tracked字节及Git/index/status保持。

两个服务分别05:36:30.780Z与05:47:30.614Z原exec/native退出0，公开shutdown200、launcher0、物理/输出/请求结清，余3486613/2826795ms，同一截止未延长。认证与完整models复制对已退休，源auth metadata和catalog字节/metadata均保持，模型0/累计1083。用户18571及真实数据库未操作。

实时交错、landing拒绝、进行中切来源的确定性UI复现，以及超过80条分页和真实输入法组合输入仍未取得，不宣称端到端覆盖；本批以控制流修复和真实正常/换源/关闭路径验收交付。无UI自动化测试，无新增非UI公共逻辑，未以纯数据夹具或组件测试冒充实页。同步架构、三索引、8图与原始工具/原生退出/数据回执后运行当前docs检查，再范围提交和正常推送。
