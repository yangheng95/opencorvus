# 内置浏览器中的 Goal 首页实际复核

## Recall

继续单 agent 自主迭代，后续单 agent 指令覆盖旧 goal 的 Astra 文案，不委托。用户主要指出“不知道 Goal 怎么用、默认首页布局怪”，并明确要求“内置浏览器调试”。458 是 progress：b619cc4e2fc69c4c9f9978a161fb8779fa0b188f 正常推送后 fresh fetch HEAD=origin/main；Goal 三种具名错误、运行时 41→345 接口及重复/并发 components 根因已修复，32 例/98 断言、最终14个真实SDK/HTTP请求通过。schema2/106 Project/143 Session 完整保留；两个native scope和全部checker物理/输出/请求/launcher及runtime/private授权对均关闭。原完整保存10s/恢复5s性能仍未达，持续目标active。开始仅既有.bun/和packages/opencorvus/bun/未跟踪。

重要纠正：cua.getState 的本地浏览器清单报 Work 设置禁用，但用户指定的 cua.createBrowserTab("iab", "about:blank", {visible:false}) 已实际成功，返回 ChatGPT in-app browser / browserID 2，agent自建tab 1（REPL句柄goalDebugTab）。因此先前根据清单错误泛化“内置浏览器不可用”的结论有误；本轮使用已成功的同一内置绑定，不要求用户改变Work开关，不绕权限或使用外部CDP/Playwright进程。458归档保留当时缺少当前视觉验收的事实，不能追造旧截图。新tab目前仅about:blank，用户原有18571 tab未操作。

已应用 computer-use 和 benchmark-debug-template。所有UI动作只走cua_repl；使用真实交互、截图、人工复核，不新增或运行UI自动化、DOM断言、组件测试、browser fixture或像素基线。用户18571/窗口/进程与真实用户数据库不操作；不建branch/worktree，不清历史、不提高cache/性能门槛。若需Provider调用，已授权auth与完整models新鲜成对，分别验证credential/catalog/实际gpt-6.1-sol和streaming，秘密不入日志/spec/提交；完整结算后退休配对。

## 修改前分析与现有证据

已读441 Goal home entry、452 home copy/layout实际结果与当前continuous-goal/current architecture，当前ContinuousGoalControl、GoalDialogHost、App挂载、main.tsx创建入口及continuous-goal.css。前序441已有真实自动Goal一轮、预算终态与operator完成，452已有正式构建双语首页/指南/表单截图；这些是明确历史证据，不能代替本轮页面。UI源码此后没有相关变更，最近SDK变更仅三处类型/文档，前端运行JS没有改变。

目前home由紧凑说明、创建持续目标和如何使用组成，正文14px、按钮md，复用canonical project/global Conversation创建后打开精确owner的现有表单。普通状态条属于另一紧凑呈现。用户当前可观察问题仍需在真实页面重现；实际viewport、语言、初始选中与侧栏宽度、文案/按钮可见性、滚动/对齐和交互都标未知，不能凭源码或旧截图直接修改。执行/数据/错误/消息/调度与Task/Mission/Session occurrence本轮默认不改；如实际页面暴露共享恢复、并发或终态异常，立即按全部入口与正常/终态/重试重启/串并行/多项目横审。

## 实施前方案与验收

1. 新自有native开发/ui scope复用完整QA412历史与当前未改变的正式前端bundle；在既有内置tab 1导航到该自有服务。先真实截图首页，查看语言/布局/可见交互，不刷新用户页面。只读DOM/样式用于根因调查，不能作为视觉验收或断言。
2. 实际打开“如何使用”、创建/取消目标表单，覆盖项目和全局入口，观察操作反馈与状态区域。需要新的自动Goal执行时只用明确有限预算、精确gpt-6.1-sol和真实可见controller/assistant消息；不生成假消息/结果，不将预检或旧441执行说成本轮新执行。所有真实新Chat/Goal记录保留。
3. 有可观察缺陷后先补齐直接触发、共享数据流、旧路径未根治原因、定义/全部调用与公共约束、测试/交付风险，再改唯一当前实现。UI改动必须接入现有语言/token，正式build并在新冻结服务中截图人工复核；不能只换磁盘资源就宣称运行服务加载新构建。没有真实问题不做猜测性布局覆盖或重复旧实验。
4. 最终截图覆盖实际首页/指南/表单及必要的Goal状态，中英文桌面为目标，不扩移动端。记录当前真实viewport，不编造像素值或测量结果；截图保存原bytes，按当前实际视觉决定是否继续修改。源码类型/build/i18n/renderer只是补充。
5. 自有tab及时关闭；公开shutdown，原native/输出/请求/launcher及checker结算，readonly SQLite保留所有原身份/归属/目录/schema，实际秘密扫描后精确退休复制对。安全归档与三索引、当前文档检查、范围commit、等待fetch/merge/完整待推集合终态后正常push，fresh fetch。无版本/tag/Release发布，目标继续active。

## 实际体验后的变更前分析

18733 的真实1280×720截图已覆盖英文项目首页、英中文指南、英文创建表单、中文全局首页以及一轮真实Goal执行及operator完成。首页、指南、表单未复现裁切；不改布局尺寸。项目入口创建ses_-zURR5ESgzz9bL80N3L2，自动控制器触发真实gpt-6.1-sol流式请求，回复GOALREADY459，1/1轮、38,351令牌，随后operator通过详情提交明确完成证据。不能将该operator完成描述为模型自行完成。

可复现的小问题：首页中英双语正文“成果与预算”/“an outcome and a budget”把预算写得像必填条件，而真实表单、指南和现有数据契约明确预算可选，留空不限额。直接触发是两个locale的continuous_goal.home.body；全仓搜索该key只有ContinuousGoalControl首页一处调用及两个语言定义，没有第二数据源。此前452调整正文大小和按钮尺寸，没有纠正此语义。公共API、事件、模型调用、权限、DB和调度不受文案变更影响；测试范围仅真实页面与截图，不新增UI自动化。风险是更长文案换行，因此正式build后以新冻结服务重新查看中英首页。方案：唯一key改为说明成果驱动的跨轮次执行，并明确预算可选；不改变目标本身的预算规则或布局组件。

## 结果与验收

- 完成上述双语正文调整；正式bun run build:overlay --skip-tauri原句柄80102 exit0，Vite实际1m14s。没有链接用户正在使用的桌面二进制，也没有重新生成或初始化真实用户数据库。
- overlay typecheck、check:i18n及check:renderer-surface原句柄53687 exit0；2 locales/2505 keys。这些只是辅助检查，视觉结论来自[11张实际截图与人工复核](../../artifacts/2026-10-20-goal-home-live-review/README.md)。没有UI自动化。
- 新构建复制到全新459-final冻结bundle，在18735独立native开发/ui服务重新查看英文和中文首页。正文、常规主按钮与指南入口完整，实际1280×720未复现裁切；不宣称覆盖其他窗口尺寸。两种语言的指南、项目表单、全局表单取消和真实状态均在18733先实际操作。仅正文改变，其余交互实现未变。
- 真实Goal pev_g0VYYus04006G2ZPSE1C：一条持久化continuation_requested、一条真实goal-controller和一条assistant，实际gpt-6.1-sol流式HTTP200/eof且请求Session/agent精确一致；返回GOALREADY459，累计38351令牌，1/1轮budget_limited。通过详情和完成证据表单operator记录complete；没有模型自行完成的说法。全局取消表单的ses_-zURR4n5MzzR7nmNQonT保留为空会话。首次只读采集脚本误用part.session_id报错，按当前session.sql.ts改为通过message_id关联后重跑，事实采集exit0；不归因于产品。
- 自有tab已关闭。18733/18735均公开shutdown200，原句柄53441/17201 exit0；两个native物理、输出、请求、launcher均结算。实际秘密值扫描通过后退休两套runtime/private凭据与完整模型目录复制对；来源未写、未交换或刷新。用户原18571服务/页面/窗口未操作。
- 只读SQLite schema2，最终109 Project/147 Session；106/143及108/146全部原身份、归属、目录保留。当前构建与文案均没有schema变化。完整历史配置保存10s/恢复5s原性能失败仍未解决。
- docs:check（345操作/26组）、api:routes-check（35文件/6规则）与check:architecture-index（20文档）均exit0；git diff --check通过。

下一条真实体验线索：新建Goal会话首次控制器续跑后，真实会话标题变为“Continuous goal controller — automatic continuation 1.”，侧栏截断后难以识别用户成果。截图与只读session.title已证实表现；根因与现有自动标题契约尚未横向调查，不在本轮凭关键字补丁修复，后续先搜索所有标题入口/参与者再落盘方案。
