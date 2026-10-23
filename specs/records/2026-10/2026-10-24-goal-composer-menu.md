# 持续目标收敛到输入框加号菜单

## Recall

用户原话：“这个goal要像codex一样命令启动或者塞进+中，放到UI上等于是脱裤子放屁”。选择用户明确接受的加号入口：移除首页独立Goal区域和无目标会话的常驻创建条，主输入与侧聊通过加号打开唯一现有表单；已创建目标保留进度、暂停和详情。单agent执行，不创建分支或工作树，不使用凭据或发起模型请求，不操作用户应用/进程。

验收：真实开发服务的 /ui 桌面页面人工查看截图，覆盖默认首页、加号菜单、中英文表单、草稿预填/取消、既有会话与侧聊入口；类型、语言键、样式和正式构建、文档检查。无用户界面自动化测试。若无法获得真实执行/状态证据，明确限定资格，不把入口验收当模型执行验收。

已读：AGENTS.md、package.json、overlay/package.json、continuous-goal当前架构、2026-10-22-goal-home-hierarchy、2026-10-23-side-goal-live-experience；App、main、ChatComposer、SideChatPanel、ContinuousGoalControl、composer-attachment-acceptance、相关CSS及语言文件。全仓搜索三个Goal挂载、GoalFormRequest/GoalLaunchContext/onStartGoal、所有ChatComposer调用、旧首页样式/语言键与相关测试。相关service/refresh/history测试是非DOM的传输/状态合同，未发现本轮涉及的组件自动化测试。不委托。

## 修改前分析与影响面

可观察的实现：App在首页输入与示例后挂载独立Goal区，其他会话在header下常驻ContinuousGoalControl；SideChatPanel也常驻该控件。组件在无Goal时仍渲染名称、空态和创建按钮。直接触发为所有进入首页/会话的用户，而非明确启动目标者。根因是创建入口与既有目标状态投影耦合于一个永久可见的section。旧首页层级调整只改变布局，没有把高级启动动作收进现有加号菜单。

定义与调用：ChatComposer拥有现有加号菜单，App拥有Home到新Chat的确认交接，main执行原Conversation创建/选中；SideChat使用自己的输入框和独立Session。通过组件属性传递明确打开请求，表单/请求身份、API authority（应用程序接口权限上下文）、selection epoch（选择轮次）、owner（归属）和草稿仍由现有组件负责。无新全局Goal store、事件总线、消息或工具路由。

现有刷新以Goal section自身高度为可见性条件。收起空态后该高度为零会误停读取，必须改为检查其所属可见会话容器，确保模型通过原工具创建目标后仍能显示同一HTTP投影。这是展示订阅的可见性适配；未发现调度、队列、恢复或终态异常，本轮不改运行时。

数据/公共契约/交付：服务接口、SDK（软件开发工具包）、目标执行、预算、鉴权、数据库schema（结构）及迁移、版本和发布均不变。保留用户现有ToolPayload、conversation-ui、conversation-reading-anchor和07-panel-reactivity改动及视频/历史截图删除。仅提交本轮精确文件。风险为菜单关闭与Dialog焦点竞争、隐藏空态后刷新失效、Home/既有会话的打开请求跨选择误用；用局部单次请求、原选择清理和实页交互检查。

## 实施方案

1. App用渲染回调把加号打开动作传给ChatComposer；Home与已有owner控件接收局部打开序号，保留原Home确认交接。SideChat输入增加加号菜单并使用同一表单。菜单只请求打开，不创建会话/目标或发消息。
2. 删除旧Home独立呈现、空态行及仅服务这些节点的样式/文案；只在有目标时展示状态条。帮助放到现有Dialog中，当前界面语言完整覆盖加号名称与动作。
3. 新建空数据隔离Source CLI开发服务，不复制用户库/auth/models、不运行模型；真实页面截图并人工复核，再按观察调整。运行针对性的类型/语言/样式/正式构建和文档检查。
4. 同步当前架构与spec索引，记录实际结果、限制；范围提交，fresh fetch/merge、审查全部待推提交后正常push。

## 验证结果

已按方案实施：主输入加号和侧聊加号打开原目标表单，首页Goal区域与无目标状态条删除；已有目标状态条保留。原Home确认交接、作用域/请求身份/预算/执行全部保持。空态收起时以所属会话容器的真实可见性维持原投影刷新；打开请求等初次读取完成后才选择创建或详情。帮助移入原Dialog，旧首页CSS（层叠样式表）及文案删除，菜单的可访问名称改为更多操作/More actions。

Overlay类型、语言键检查（2语言2536键）、CSS token（设计变量）检查（8867引用/268变量）、正式Node Vite构建（7315模块，1m30s）及renderer公共面检查通过。docs:check为345操作/26组，architecture-index为20文档，git diff --check通过。仅UI改动，没有新增或运行UI自动化测试。最后只调整JSX（JavaScript扩展语法）括号与缩进，类型/语言/样式再次通过。

[12张人工查看的真实截图及证据](../../artifacts/2026-10-24-goal-composer-menu/README.md)覆盖英文首页/菜单/表单/帮助/取消、中文菜单/表单、已有Work空会话和独立侧聊加号/表单/取消。所有表单均用原草稿预填且取消后保留；菜单关闭后焦点实际进入目标字段。没有把DOM（文档对象模型）文本或构建结果当视觉验收。

首次隔离服务19231因固定Bun可执行文件旁带旧ui目录，按现有资源优先级实际呈现旧UI；图01明确作为旧前态，不作为新代码通过。公开关闭后，新19233服务从仅含Bun的自有bin启动，按现有规则使用workspace dist-vite，实际显示本轮加号界面；本轮构建产物为main-CpLITCN5.js。没有操作或重启用户服务。两个原exec均退出0，公开shutdown均200，native/launcher退出0，physical/output/request完整结算。两服务实际模型请求0，无auth/models复制；新空数据根没有读取或迁移用户库。闭合只读库为两个空Session、0 Message、0 Goal事件。记录器首次误读event_type列，核对真实schema后改为type并重读同一数据库，原失败保留。

Task/Mission独立页面、既有Goal暂停/完成和模型自动续跑未在本轮重新执行；它们的代码路径未改，不宣称新的执行验收。无schema、迁移、版本、Release（版本发布）或tag（标签）变化。工作区同时存在其他任务提交及spec索引添加，只暂存本轮精确文件/索引行，保留其余改动。最终提交与push以Git实际输出为准。
