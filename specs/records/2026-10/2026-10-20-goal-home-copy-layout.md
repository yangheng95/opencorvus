# Goal 首页说明的桌面布局

## Recall

用户原始问题是“完全看不到goal怎么用的，而且默认页布局很怪”，持续授权单agent自主体验、修复、真实验证、提交及正常push；旧goal文案中的三个Astra已被后续单agent要求覆盖，不委托。上一轮451属于progress：b2313af2df18db17664f61b30c39f8590c95ba82已正常推送，fresh fetch证明HEAD=upstream，四个新正向投影合同随七文件38例/129断言通过。完整保存两项实验因没有稳定整体收益均撤回，原10s/5s性能目标仍未满足，不能宣称已修复。全部自有服务、runtime和私有auth/models已结算退休；保留完整91 Project/schema2历史。开始只有既有.bun/及packages/opencorvus/bun/未跟踪。

本轮回到用户直接指出的首页视觉：451真实1280×720英文截图中Goal说明末尾在按钮前被截断。采用已应用的computer-use和benchmark-debug-template真实链路要求，仅自有开发/ui及临时tab，不操作用户18571、窗口或进程，不新建branch/worktree，不清库、不改变schema，不新增/运行UI自动化。若需真实Provider预检，只复制已授权现有auth及完整models目录并核对精确gpt-6.1-sol和流式请求，敏感值不入日志或提交。当前页面布局原契约是441已交付的紧凑说明+创建主操作+使用指南，不恢复三列教程或另建Goal事实。

## 修改前分析与待核实项

已读441入口方案、451最终Recall、当前continuous-goal架构User controls、App首页挂载、ContinuousGoalControl home/普通/compact三种呈现及全部welcome/home CSS定义与调用。全仓该welcome/home-actions只有同一个组件和continuous-goal.css实现；中英文词条接入现有i18n。当前home为可换行flex容器，welcome flex-basis280px且内部文字min-width0，两个操作占右侧；源码p没有显式截断，但截图末尾确有缺字，实际生效的CSS、已构建资源与收缩关系仍未知，不能仅凭类名认定根因。一次初查错误引用不存在styles/base.css导致rg exit1，已按实际styles目录重新查找；不以该工具错误作产品证据。

旧441修复了入口与信息架构，不代表覆盖所有长文案/桌面宽度。相关公共合同、数据、队列、Task/Mission/Session轮次与Goal调度本轮都不修改；若实际创建流程暴露共享生命周期异常则立即横审，不归咎模型。UI自动化在当前已读路径未发现，不调用overlay test/unit runner。主要风险为过宽通用选择器影响普通状态条或指南，故以唯一home区域根因修复、保留语言原文及当前设计token为边界。

## 实施前方案

1. 启动一个自有native开发服务，复用完整91项目验证历史与原正式UI副本。在真实英文首页截图，并只读观察实际元素样式/资源，明确截断来自哪条实际规则；必要时检查CSS加载顺序，禁止猜测性覆盖。
2. 根因明确后补记证据再改唯一当前样式或资源构建路径。保持现有模块顺序、桌面密度、输入框/示例/Goal区对齐；文案完整显示、创建/指南可点击。通用样式污染则修作用域；仅布局收缩则用现有flex/grid及token解决，不增JS宽度侦测或第二布局状态。
3. 官方overlay build并投影到同一自有bundle，自己的tab重新加载；实际1280×720中英文首页及必要的侧栏展开状态截图人工复核，点击指南与创建、取消表单。仅CSS改动不虚构新的完整LLM任务验收；原native预检及真实创建HTTP作为本轮证据，441完整Goal执行是明确历史证据。类型、i18n、CSS token、renderer/build、docs及架构索引为补充，不替代截图。
4. 公开shutdown，原native/输出/请求/launcher结算、runtime/private配对退休，最终直接readonly SQLite核对原schema和保留历史。新artifact精确路径归档并扫描实际敏感值，更新三索引及必要架构，范围commit、fetch/merge、完整待推集合复核、正常hook push、fresh fetch验证。持续性能目标仍active，不因本轮UI修复标记goal完成。

## 真实复现与实施前收敛

原正式UI的独立tab52、18705服务真实预检gpt-6.1-sol/streaming=true。1280×720默认280侧栏下，完整说明确实显示，p computed whiteSpace=normal、overflow=visible、height18px、client/scrollWidth均467；展开侧栏到433后自然两行，全文仍可读。初始“缺字”截图判断没有复现，禁止新增nowrap/overflow覆盖来修一个未证实的根因。正常缩进显示的project是该自有服务真实sandbox/project目录，不能因通用名字认定为错误上下文。

实际可改善的是入口层级：说明继承普通紧凑状态条的12px caption，原创建按钮size=sm实际高度24px（字体14px）；这与持续目标作为首页主要起点的发现性不符。源码根因是home复用continuous-goal caption以及按钮显式sm，441只更换信息架构而保留紧凑尺寸。不是字体丢失、构建目录缺漏或后端数据错误。

实施选择只改home：continuous-goal--home覆盖为现有14px body token，创建按钮使用现有md尺寸；保留普通/compact状态条、次要指南按钮、原flex换行和全部文字。全仓唯一home定义及Button primitive的大小合同已核对，不新增断点、布局状态或第三套样式。14px长说明预期自然两行，CTA按已有md控制高度显示，模块顺序与输入区对齐保持。最终必须实际重建并截图中英文、正常/展开侧栏、指南和创建/取消；若视觉拥挤则在同一现有布局规则中修正，不把类型检查当作视觉证据。

## 构建与服务资源边界

正式build原20696 joined0、renderer public surface通过；typecheck原32697 joined0，i18n/CSS token和两文件格式均exit0。先将完整新UI投影到自有bundle并保留ui-before，再只刷新自己的tab52，实际仍是sm/24px和12px，故这张after-home-en截图明确不是新UI验收。overlay-ui.ts的目录资源源在服务创建时读取并保留原文件bytes，符合正式运行中资源一致性合同；不能靠刷新页面把已有服务切成新构建，也不应为本次验收改生产资源合同。

调整验收：原18705已公开shutdown200、原57603 launcher joined0并自动退休runtime auth/models，tab52已关闭；原服务完整物理/输出/请求结算。使用同一完整历史、保留私有配对、新鲜18707服务及独立tab加载正式新构建，再进行实际中英文与入口验收。没有操作或重启用户服务，不把旧服务截图称为最终视觉通过。

## 最终实际结果

冻结新构建的tab53真实页面确认：首页说明14px、line-height21px，英文默认两行；主创建为既有md实际30px（不是凭预期写成32px）。保留原默认280及展开433侧栏、1280×720桌面密度，正文完整，按钮可见。中英文首页、指南、实际项目/全局创建表单与取消后的普通状态条均截图人工复核；普通状态条保持原紧凑尺寸。一次手动工具错误把“新对话”猜成“新建对话”，未匹配点击，随后依据真实AX树的“新对话”按钮继续成功；不将操作工具错误当成产品缺陷。

英文项目首页创建原POST/coding/work/session返回201/64ms，新会话ses_-zURRzNLvzziJt55rlmO绑定原project目录；中文全局首页POST/global/work返回201/1531ms，新会话ses_-zURRz7YKzzSQQ3aohVT绑定真正新匿名Project。均自动打开同一现有Goal表单，取消后保留真实空Chat。没有提交新的Goal执行或伪造Message；441完整Goal执行为历史证据。本轮两个新native服务各自预检实际gpt-6.1-sol流式成功，不能将预检称为新Goal执行验收。

最终18707公开shutdown200，原35349 joined exit0；两轮原native physical/output/request/launcher及runtime配对均结算，自己的52/53标签均关闭。最终直接readonly SQLite为schema2/94项目，两份新Chat真实记录在各自Project下，保留全部旧历史。没有用户数据库初始化、schema变化或用户进程操作。本轮只有home字号和主按钮大小两处产品源码变化，没有新增后端测试或任何UI自动化。

证据归档到[Goal首页说明与入口层级](../../artifacts/2026-10-20-goal-home-copy-layout/README.md)。原保存性能10s/5s要求仍未满足，本轮不改变其验收范围、指标或既有失败结果；持续目标保持active。
