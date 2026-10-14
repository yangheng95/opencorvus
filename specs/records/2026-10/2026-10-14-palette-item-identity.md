# 第24批：命令面板工作项身份

## Recall

- 用户要求持续按批迭代直到明确停止，Root自己做并验收，停止子agent；不向其他聊天发提醒。当前agent清单只有Root在运行，旧audit_ui已经completed，没有新委托。前批af6d6896f正常commit/push实际0，原全部hook通过；fresh fetch/merge和原远端main为58096d4d7，own提交已为upstream祖先。保留其他任务的Git、权限、Session、compaction与文档工作，不操作其页面/进程。
- 本批调查命令面板同名Chat与Work在同一Project中能否辨识，延续B23已真实显示的通用assistant图标线索，不先把候选当已确认缺陷。
- 已读CommandPalette完整查询/展开/命令构造/选择/数字快捷键/焦点/render；唯一conversation-experience图标与语言label helper、所有生产调用（App、WorkLedger、Archive）；ComboboxControl当前ItemLabel/ItemDescription和翻译/选项合同；cmdk布局；07-panel会话canonical experience与统一Briefcase身份/查询合同、07-panel-reactivity；B23完整Recall/真实资格、command-search历史决策和当前indexes/CHANGELOG。
- 全仓定义/调用检索：rowCommandIcon/rowCommandHint只有CommandPalette内部使用；App只有一处挂载。canonical WorkLedgerChatRow已经携带experience，选中时按原experience传给onSelectChat；其他页面使用唯一conversationExperienceIcon/Label，面板却一律返回avatar-assistant，并只显示目录basename。检索相关overlay/test未发现CommandPalette UI自动化；不新增或运行UI自动化。Task/Mission既有本地化kind键保持，原数据原文不翻译。

## 根因与影响分析（实施前）

1. 可观察候选：同一Project的同名Chat、Work具有相同label、项目hint和图标；鼠标或键盘操作者只能凭顺序猜测目标。实际before页面/截图与正式API身份读回前，不宣称已复现。新真实输入标题使用相同的“季度计划”，目录不包含类型关键词，避免默认命名偶然提供区分。
2. 直接触发和控制流：服务器row.experience正确，Command构造时rowCommandIcon丢弃它，rowCommandHint也丢弃kind/experience；共享Combobox的说明本可承担身份描述，当前只收到目录。选择动作仍携带真实ID/experience，因此是呈现遗漏而非后端身份串线；真实点击后的公开读回必须再次核对原身份。
3. 旧路径未根治：B23修正服务器experience搜索和消费者重复过滤，刻意没有改图标/提示；WorkLedger和Archive已使用canonical helper，但CommandPalette私有转换没有接入。不能靠修改标题、目录、用户原文、重排或另一份类型映射掩盖。不是调度/唤醒/恢复/终态异常；若实际操作出现此类异常则按仓库要求横审全部入口/轮次，不归因于偶发。
4. 方案：真实复现后，chat行图标直接调用已有conversationExperienceIcon；hint由原类型的当前语言label和原目录basename组成，conversation使用conversationExperienceLabel，Mission/Task使用既有work_ledger.kind键；没有目录时只给类型label。保留原label/ID、Mission/Task图标、查询membership/展开/顺序、shortcut和选择/焦点生命周期。只修改CommandPalette，不额外抽象重复的工作项组件。
5. 影响面/契约：唯一面板当前可选Chat/Work/Mission/Task的提示文字与Chat/Work图标，空查询和搜索结果共享。ItemDescription同时进入已有可访问说明，optionTextValue沿现有hint传入，不加隐藏消息或影子状态。没有服务、SDK、接口/错误/路由、配置、数据写入、schema/持久格式、迁移、模型请求、host流程门或兼容路径变化。翻译复用现有语言目录，原文title/directory保留，不增加平行事实源。
6. 真正验收：独立开发backend /ui，before18666/67使用前批冻结Node UI，after18668/69使用新Node构建。完整公开catalog加随机虚构auth/models整对；不复制用户凭据。两Project各声明原Chat/Work及一个原Mission draft，公开HTTP创建/命名为同标题，明确未派发。正式checker记录每次原输入/status/body后再核对，正向确认原kind/experience/ID/project及Mission原请求。仅实际Chat/Work/Mission声明/选择，不冒充Task执行资格。
7. Root亲自真实桌面交互/原图：修前同Project同名候选及侧栏不同真实身份；修后空查询与同标题查询区分Chat/Work/Mission的icon/当前语言hint，中英切换，实际通过可见候选打开原Chat、原Work、原Mission草稿；至少一次当前数字快捷键打开。通过公开GET再次读回原identity及原draft/未执行状态。截图原件不编辑、人工查看后必要时修正重拍；不新增/修改/运行UI测试、源码文案断言、DOM/组件/快照/像素测试。
8. 检查/收尾：overlay类型、Node真实build、当前docs:check/架构index和正常提交push hooks。纯UI改动以真实页面为验收，不伪造业务单测。两个隔离服务正常marker→settlement→父进程实际exit→双端口0→精确删除自身假auth/models同对→完整原日志隐私复核；自有tab关闭，用户/其他任务进程与凭据不动。全部失败原件保留，工具故障先修复并重跑原检查。
9. 交付：本spec/三indexes先落盘，再按证据实施；当前架构与中英未发布增量同步，原图/HTTP/检查/生命周期与前批真实正常push原件入artifact。范围可审查commit，fresh fetch并merge上游，审阅完整pending集合与必要验证后正常push；不新branch/worktree、不rebase/force/no-verify，不tag/Release/PR。每一批正常结算后继续下一批。

## 实施前状态

仅分析与验收方案；产品尚未修改，真实before页面待观察。未获得的新资格不写成通过。

## 实施前真实确认

before PID57596、18666/67，occurrence b8b55a6a-a985-43c3-b184-8cbc278e2c19。正式17次HTTP实际0，创建/命名并精确读回两Project的4个原Chat/Work与2个原Mission草稿；6项同为“季度计划”。Root亲看01空查询和02已结算同标题查询：同Project的Chat/Work图标、title、hint均相同，只有Ctrl序号不同；原侧栏同时可见正确的Chat气泡/Work公文包/Mission图标。Mission本身图标同avatar-assistant视觉相近，更说明类型label有必要。服务器原kind/experience/ID正确，缺陷确认位于面板私有呈现，不修改数据或搜索。tab28已关闭，并请求自有runtime正常settlement；没有选择或派发原记录。按已落盘最小方案实施。

修后首数据检查在服务启动ready原件产生前读取文件，实际ENOENT/exit1，尚未发送HTTP；12:44:40启动的PID78496于12:44:55正常产生ready，原两端口随后都在本PID监听，没有生产接口失败证据。先保留原data-after非零和旧checker，工具补30秒有界ready等待，再以data-after-ready重跑原6项正式输入/读回。不得把启动时序工具错误包装为产品失败或覆盖成成功。

## 最终实现与实际资格

- 产品只改CommandPalette一个文件：Chat/Work图标调用现有conversationExperienceIcon，hint用现有当前语言类型label及原目录basename；Task/Mission已有图标保持。原title、服务器membership、Mission子项predicate/顺序、数字快捷键、选择回调和焦点处理未改，没有新状态或第二类型事实源。当前架构与中英未发布日志同步，未更新版本或创建发布。
- overlay类型实际0，Node真实build实际0（1m7s），原第三方use-client及大chunk等warnings完整保留。当前docs345/26和架构20实际0，架构文档数增加来自其他已授权任务的现有变更，不把它当本批新增。没有UI自动化、源码文案/DOM/渲染/像素断言，也没有以类型/构建代替视觉。
- after PID78496，18668/69，occurrence4c36bdc3-cb09-413a-affe-1fb8d621171a。修正原准备器重跑17正式HTTP实际0，6项原kind/experience/ID/Project/draft均正确；人工操作后ui-final另7次正式读取实际0，原会话身份、Mission原请求/backlog/Task统计保持。两轮合计41个独立正式响应body，UI自身请求另计；首ready错误没有HTTP，不计成功。
- Root逐一查看10张未编辑原PNG：01修前最近项、02同标题查询；03/04最终英文最近项/同标题查询，Chat气泡/Work公文包与类型/项目hint可区分；05鼠标实际选择A-Chat，06按当时可见Ctrl+6实际选择A-Work；07中文同标题6项，08点击B-Mission显示完整原请求且尚未开始；09中文Work查询显示两个原Work及本地打开文件夹/Work设置/网络命令，10按当前Ctrl+1实际打开B-Work。截图的侧栏选中行/页头图标/Composer体验与原正式输入相符。Mission/Chat/Work是当前产品技术名称，中文通过既有语言键保持这些名称，不自行翻译改变身份。
- 本批最终原目标：A-Chat ses_-zUS0BH9KzzofK8X43ql、A-Work ses_-zUS0BHBTzzQX2ST2iDm、B-Work ses_-zUS0BH6Bzzdk7kvydMA；B-Mission13eba0f775fa3ee5，原请求“这是B项目的原季度计划草稿。仅确认同名工作项的选择和重新打开，不派发执行。”完整可见。Task执行/恢复、长列表分页/长目录截断、Provider推理与不可逆删除未独立操作，不借这些截图宣称通过。
- 中文切换首次数字AX点击在候选重建时工具无法解析shadow-root目标，没有确认动作成功；重取当前候选后实际Enter选中中文并完成截图。仅工具定位观测，不冒充应用缺陷或首次点击成功。未派发、不发送任何消息，无真实Provider凭据或Sol调用；全部参与者inference requests和realSolCalls均0。
- 只有自有tab28/29，均关闭；before/after正常settlement、原父exit0、各自双端口0，再精确删除生成的auth/models同对，隐私checker0。完整后台原日志103958/162743字节，stdout/stderr各0。用户/其他任务进程、页面、凭据和staging保留。
- 原失败/修正前checker、41正式HTTP原件、10原图、完整检查/日志/生命周期与B23正常交付回执归档。随后按实际范围commit、fresh上游merge、完整pending审阅和正常push回执结算；此处不预写未来成功或SHA。
