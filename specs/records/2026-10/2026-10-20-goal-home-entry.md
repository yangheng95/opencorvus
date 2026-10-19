# Goal 首页入口与默认布局

## Recall

用户指出“完全看不到goal怎么用的，而且默认页布局很怪”，要求持续单agent实际体验、修复、提交推送。保留440当前未提交的共享生命周期修复，UI单独提交；不操作用户进程、不开分支、不删除历史数据、不更改schema，不新增或运行UI自动化。当前18571无监听，使用440自有18665原生开发服务与独立tab30；已截图人工观察当前默认页和真实完成会话。配对凭据与模型目录、gpt-6.1-sol实际streaming预检已成功。采用已读取benchmark-debug-template的真实链路与证据要求，页面通过真实交互、截图及人工复核。

## 修改前分析

可观察现象：默认页标题/输入框/示例之后有整块三列步骤，只有About goals和聚焦输入框的按钮；用户仍必须先发送普通消息、找到顶部Create goal才能启动。窄桌面中心列教程拥挤，说明占用首页主要视觉空间。旧433只添加指南，没有提供可执行的起点，不能根治发现与启动断层。

已读App.tsx、ContinuousGoalControl.tsx、Conversation.tsx、main.tsx创建/导航流程、conversation-session.ts两个canonical创建函数、chat.ts、双语词条、conversation/continuous-goal样式，搜索全部ContinuousGoalControl调用（包括SideChat）；已读continuous-goal架构及controller/store真实合同。后端允许新建空白standalone Session作为Chat目标归属，frontier明确为start，scheduler自然创建可见goal-controller消息，无需伪造用户消息。Task/Mission现有入口及预算/状态不变。首页目前没有真正Goal owner，不能伪造target或增加草稿持久化/第二goal store。

## 实施前方案与验收

1. 首页提供明确“创建持续目标”按钮，复用现有createConversationSession/createGlobalConversationSession、API authority与workspace selection epoch，先创建并选择真实Chat，再在该owner现有ContinuousGoalControl打开同一创建表单。全局首页保留自动建立匿名Project的唯一入口，项目首页使用当前Project；不写假消息、不另建API、不新增schema。创建期间禁用重复点击；导航失效不在其他owner自动开窗。错误进入现有导航错误呈现。
2. 一次性打开请求由App当前生命周期持有，精确绑定创建返回的session ID；交给该Control后立即消费，后续选回聊天不再重开。表单现有request ID/revision/authority合同保持。取消仅关闭表单，保留真实空白Chat。
3. 用紧凑的Goal操作区替换首页常驻三列教程：一句说明、主创建按钮及“如何使用”次操作；详细步骤仍在现有About dialog内。输入区与标题统一宽度/间距，避免顶部教程挤占输入；新中英文词条同步。旧聚焦输入按钮和仅为它服务的文案/props同步替换。保留聊天、Mission与Task信息架构，不扩大其他页面清理。
4. 重建官方UI包后仅投影到自有服务bundle；实际截图复核首页、点击创建直达表单、取消可返回、再创建/填写目标与1轮预算、真实gpt-6.1-sol流式执行、详情/状态可读及中英文。类型、i18n、renderer和build检查只能作为补充，不能替代截图。不新增UI测试；触及路径发现的UI自动化按规则移除（当前所读路径未发现）。
5. 同步continuous-goal当前架构、record/artifact三索引和文档检查，范围提交；与440已验证交付一同fetch/merge upstream、审查完整待推送集合、正常push。未通过性能门槛保持440记录，不能当作首页已解决性能。

## 结果

初次真实验收已证明首页直接创建canonical Session、自动打开目标表单、取消留空Chat、中英文表单正常。复核发现一次性请求仅携带Session ID，跨服务或离开后再进入同ID的导航寿命不够明确；在交付前把该同一临时请求完整绑定原API authority与selection epoch，Control消费时校验后再打开，退休请求只结束自身临时表单意图。这不是新增Goal事实或持久化队列。需要以最终冻结构建再真实验证。

最终实现：首页输入区下提供明确创建主操作和“如何使用”，详细三步说明收进现有弹窗；标题、输入框、示例与Goal区共享宽度与留白。点击创建通过现有project/global Conversation函数创建真实Chat，再把原authority、epoch和session ID绑定的一次性表单请求交给同一Control；成功或退休后消费，不新增Goal存储、消息、API或数据库版本。双语完整同步；详细步骤第二步改为在已打开表单填写并提交，避免仍提示重复点击顶部。

真实验收：441-final独立tab31从全局首页直达创建表单；取消保留空白Chat，顶部创建可再次打开。实际填写中文目标“仅回复GOAL READY…”和1轮预算；原scheduler自然发布可见goal-controller消息，gpt-6.1-sol实际流式返回GOAL READY，界面显示1/1轮、budget_limited及33,708累计令牌。通过详情填写实际依据并标记完成，原HTTP读取确认同一goal status=complete、turnsAccepted=1、turnBudget=1。该scope实际请求11/12，未扩大验收预算。没有伪造模型输出或用户消息。

441-verified新冻结构建、独立tab32再次从首页创建目标并打开精确新Chat的表单，验证authority/epoch绑定。最后只有双语步骤与中文标题文字修订，重新官方build后使用441-reviewed独立tab33实际查看最终中文首页和“如何使用”截图。英文首页/表单、中文填写/运行/完成、最终首页/指南截图全部人工呈现复核；1280×720桌面，无UI自动化。build/renderer、UI typecheck、i18n、CSS tokens通过，文档/API与architecture-index通过。大chunk与第三方use-client忽略为原构建提示，未作为视觉验收替代。

自有440及441三scope均公开shutdown200、原launcher70126/14990/81558/92612全部joined0；physical/output/request结算及runtime auth/models成对退休。所有scope结束后私有auth/models也成对退休，原授权源metadata保持不变。只读原生SQLite检查自有QA数据库schemaVersion=2，完整history保留，共70项目（新增验收Chat/预检项目，没有清理旧项目）。未操作用户18571或窗口/进程。

证据：[实际页面与安全结果](../../artifacts/2026-10-20-goal-home-entry/README.md)。人工二次复核通过；已知未满足项仍为440原配置cold/restore性能门槛，与本轮首页操作完成度分开记录。当前分支按两个范围提交并正常推送，不发布版本/tag/Release。
