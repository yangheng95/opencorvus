# 双成员切换与来源阅读

## Recall

持续目标是自主体验并修复当前产品UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，重点Sources、成员侧栏Rendering和视觉质量。最新人工要求只有一个开发agent；不启动Codex子agent。应用内两位真实成员是本轮被测产品功能。已授权实际gpt-6.1-sol和完整auth/models配对使用；流式、凭据保密、独立服务/页面和物理收尾约束保持。当前schema v1历史继续保留，不再次清库。

415为progress：6370e9d9805a261ee9980a13bf2aa02f921fb106已修复协调与两处交互回答同步等待模型执行的问题，原8测试/75断言、扩展类型与真实19条Sol流通过；首次实际202从414的118925ms变为415的100ms，在原长文完成前返回，原成员随后完成摘要。六张原图、原20条历史消息/来源保持、Native22954 join25b22d0及配对退休已存。第一次push18520因远端9ad并发更新被拒绝；fresh fetch/merge和完整pending复核后34318 join7b6c31 exit0，远端精确6370。本轮不重复资格单成员或受理修复，接续未覆盖的不同成员切换。

当前HEAD cd19bd56c；其他compaction源码/测试/文档工作保留。自己的文件修改需范围提交与fresh上游合并/完整pending审阅/正常push；不新branch/worktree、不rebase/force/no-verify、不发布。整体goal active。

## 已读代码、合同与候选问题

已读415 Recall/原HTTP及交付结果，07-panel-reactivity成员目标/阅读位置合同；SubagentConversationPanel的options/selectedRecord/targetKey、资源与live合并、按targetKey保存readingPositions；SubagentProgressGrid和subagentSessionRecords/进度事件投影、AgentActivityRecord。全仓SubagentConversationPanel、subagentSessionRecords、subagentProgressCardID检索定位main挂载、Conversation、AgentRail和进度卡。没有扫描/运行UI测试。

候选可观察缺口：选择器以sessionID为真实值，但renderValue/option label只用agentID，描述仅status；列表和进度卡也主要显示agentID。同一角色的两个Session可能显示相同名称与状态，用户无法判断选择的是哪一位。当前只是源码线索，真实双成员前不宣布缺陷。Session最新轮次投影已由共享subagentSessionRecords统一；身份本身不能改成agentID或列表index。阅读目标包含API authority、source、directory、Session，旧HTTP和live只在该target内合并；跨成员错文/错来源若出现必须沿真实目标、Part、请求/事件与读取位置追查，不用“模型行为/偶发”归因。

本轮先调查，不预先修改公共字段、API、数据库、权限、调度或模型prompt。真实显示缺陷要补可见证据、根因/旧路径原因、定义调用/本地化/影响面/测试与风险后才改；任何队列/恢复/并发/终态异常立即按Task/Mission/Session全部入口、轮次、正常/终态、重启/重试、串并行和多Project横审，未排除共享根因不降级为单个场景。

## 实施前真实验收方案

复用member-live-rendering-412-fresh隔离project与v1数据库，当前Node前端构建到dual-member-sources-416-live-bundle，正式backend /ui端口18541。不启动独立Vite。复用已审Native包装器与checker；新scope预先48条累计真实请求、Native600秒、模型无活动180秒，不扩正在运行的预算。完整源auth/models由成熟助手复制且预检credential可用、目录投影与实际Sol一致，才正式CLI创建。

输入要求两位独立读取成员：一位只read README.md第2行解释价格，另一位只read第3行解释交付，各约900字、独立来源/行号、保留“仅用于界面测试”，不编造条款、不联网、不改文件；可并行，全部由真实编排器/成员/Tool产生，不写数据库或伪造消息。应用内多成员不等于开发委托。模型自然选择角色和流程，不加host gate或工具白名单。

页面检查主区两个成员卡、All agents列表、下拉选择、选择后对应正文与来源；在一个成员中向上阅读/打开来源后切到另一个，再返回，观察旧段落和位置是否保持。两位均有实际来源时分别打开原文核对第2/第3行；流中操作与完成态操作分别记录，不以已完成结果冒充流中恢复。真实截图人工查看，辅助只读DOM/AX不作自动断言，无UI自动化测试。

只读checker绑定原Task/project/request、两个真实Session与各自read Tool/source Part/消息/来源行号；比较旧415历史及本轮完成事实。若仅有一位或任务未达成，原样保留原因，不伪造第二位。若需要UI修复，先补分析方案，再新bundle和新独立scope复验；复用已完成Task阅读也要明确仅是历史资格。非UI修改另有聚焦正向测试。

结束关闭自有页面、公开shutdown、join原handle，核对原PID/出生身份及physical/output/request后退休复制凭据配对。数据保留，原失败/类型/构建/日志保留。更新本记录、相关架构与三索引，docs:check/架构检查和必要类型/构建；范围commit、fresh fetch/merge、完整待推集合和正常push，继续整体goal。

## 实测根因与实施决定（产品修改前）

真实Task tsk_g00VY03x7l00hBFRdf8z自然产生两位base-researcher：价格Session ses_hdvEOzMlLHl6S8MoqpRU，交付Session ses_ha8862QlAlLJD7Ku0sM0。05-identical-completed-options.jpg和07-identical-agent-list.jpg显示两项名称与Completed状态完全相同。09/10原图和SQLite真实read/source Part确认交付指向README第3行、价格指向第2行；04/08及01/06人工对照确认已完成成员阅读位置恢复。两位是依次完成，未资格双成员同时流中切换；没有发现调度异常。

直接触发是相同agentID对应不同Session；根因是SubagentConversationPanel仅把agentID投影为optionTextValue、renderValue、option label和列表正文，SubagentProgressGrid也仅显示agentID。旧Session去重解决的是同Session多轮次，并未提供同角色不同Session的辨识信息。真实选择值、来源Part、目标缓存和阅读位置均正确，不需要修改持久数据或网络合同。

已全仓查定义/调用及架构历史；同语义TracePanel仅做本地Session尾部显示，没有可复用的碰撞消歧函数。AgentActivityRecord与后端ConversationSessionView不带Session.title；直接扩展会影响多个投影/水合路径，且当前标题是长委托文本。禁止从模型正文或输入关键词推测职责。AgentRail按真实参与者聚合，不是本轮逐Session选择入口；消息作者保留真实角色名。

决定在现有subagent-presentation增加唯一的UI身份格式化：同agentID有其他不同Session时显示实际Session ID末4字符，发生尾部碰撞则延长至可区别；完整ID可悬停查看。无同名成员时保持原名称。共享小组件用于选择器、全部成员列表与进度卡；文本搜索和无障碍名称使用相同角色/短标识。依据真实身份，不使用列表序号、时间、哈希、持久影子状态或模型编造标签。options memo只比较真实身份及展示label，避免每个流事件重建选择器选项；targetKey和conversation挂载/滚动逻辑不变。

风险是窄侧栏长名称挤压：名称允许省略，短标识保持可见，使用现有字体/间距token并真实截图检查。新增仅技术标识，无需翻译；周围控件仍用现有i18n。纯UI格式与样式不新增/运行自动化UI测试；类型、Node构建和真实页面人工验收。无数据库、API、调度、队列、恢复和模型配置改动，非UI正向测试不适用。原Native78510已join790a17 exit0、公开shutdown 200且复制配对退休；后续新scope明确用NativeService阅读同一已完成真实Task，检验新UI及旧数据继续可读，不将历史阅读计为新的流中资格。

## 验收工具故障与处理

新页面37先成功产出11–15图，随后浏览器可见视口变成0×0，截图报Cannot take screenshot with 0 width。文档接口恢复原1280×720后DOM读到正确尺寸，但CDP（Chrome DevTools Protocol，浏览器调试协议）截图及Input.dispatchMouseEvent仍超时；不能仅据此宣布产品根因。创建同一browser4的自有页面38后输入/截图成功，16–21完成剩余实际验收。两页均关闭，临时viewport reset，visibility恢复false。记录所有失败，后图不是37原上下文的恢复；阅读位置资格在38重新建立并双向验证。

服务物理退出后并发启动两个只读SQLite checker，其中当前Task首读报SQLITE_BUSY_RECOVERY，另一个旧Task检查正常退出。直接触发是同一WAL（Write-Ahead Log，预写日志）恢复入口并发打开，脚本没有busy_timeout。修复仅诊断reader的明确锁等待，使用现有存储机制相同的SQLite busy_timeout，并顺序重跑失败的原检查；不更改产品数据、迁移、调度或采用另一数据库。原失败日志read-after-final.log保留，重跑另存read-after-final-retry.log。

## 实现与验收结果

同名成员以真实Session后缀qpRU、0sM0消歧；共享SubagentSessionIdentity组件用于进度卡、选择器和全部成员列表，文本搜索和打开/活动无障碍名称同步。选项的sessionID不变，memo只在身份label变化时更新。来源Part、canonical target和readingPositions没有改动。此次纯UI实现没有运行或新增UI测试，没有修改数据库schema、版本或发布信息。

原Task真实调用13条gpt-6.1-sol；新NativeService独立配对预检2条。两轮实际模型均完全一致、streaming=true、HTTP200、reader settled/eof，原Task lifecycle completed、实际两次read分别保留第2/3行。新scope是完成态历史验收，不宣称已覆盖两个成员同时流式更新、动态第三个同名成员、后缀碰撞或所有Rendering闪烁。

21张原始截图均人工查看：01–10是原缺陷和原来源/位置证据；11为主区初始底部（成员标题在视口外，不用于标题判断）；12为下拉与主区价格卡的同一短标识；13交付Sources打开第3行；14全部成员清晰区分；15为页面37的中段；16证明新页面38恢复；17/19价格中段、18/20交付中段往返后保持；21价格Sources打开第2行。默认380px侧栏内两项完整可区分，短标识未被角色名挤掉，正文与来源归属正确。截图路径见[证据目录](../../artifacts/2026-10-14-dual-member-sources/README.md)。

Node构建before96480/cdf286与after45417/c036d6均exit0，后者1m43；overlay tsc26513/043aff exit0。Native原78510/790a17与after67825/db2e78都exit0，两个公开shutdown均200，physical/output/request收尾齐全，复制auth/models配对退休。只读持久事实checker62030d exit0：本轮13消息/38Part/8工具/10artifact及415的17消息/48Part/14工具/15artifact内容逐项保持，v1数据库继续可读。archive-check.log在进程退出后归档，不自捕空日志。源码、精确任务/Part/请求/生命周期、读取脚本及原始失败日志一并存档。

整体goal仍active。下一轮继续补真实流中双成员切换与Sources体验，不把本轮完成态通过当作全部目标完成。
