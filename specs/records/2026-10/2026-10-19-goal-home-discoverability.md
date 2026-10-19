# Goal使用路径与默认首页布局

## Recall

用户最新要求“我现在完全看不到goal怎么用的，而且默认页布局很怪”。持续单agent、真实页面人工视觉验收后提交推送，不使用子agent、UI自动化测试或独立Vite。保留原.bun和packages/opencorvus/bun。上一批432已完成根因修复和真实验证并提交f23fc7ad4；推送结果另核对。本批不改schema、调度、目标API或真实用户数据，不触碰18571用户页面。

## 修改前分析与已读资料

已读continuous-goal当前架构全部、07-panel公开合同、App/Conversation/ContinuousGoalControl、continuous-goal service及样式、双语翻译、main全局launcher、真实Conversation create/select入口及store/controller定义。全仓搜索Control两处生产挂载（主会话、SideChat）、home portal/composition、目标选择epoch与owner投影。可观察反馈是Goal用法难发现和默认布局异常；当前App无条件把owner为空的状态条放在顶端，文案只说先打开会话，其learn对话框也只有三段泛化解释。首页本体是absolute居中三行grid，overflow hidden；说明和输入区分离，增加内容后有裁剪风险。旧实现确保了真实owner与预算控制，却没有清晰的使用路径。这是UI信息架构问题，尚无调度/队列/终态机制异常证据。

目标后端唯一实现及用户授权语义保持不变：Goal属于已有会话，创建/恢复可能开启自动续跑；不能为了首页入口造临时owner、影子Goal草稿或合成消息。预计调整主会话/默认页Control挂载、首页布局、同一Control的空态与帮助、双语文案；SideChat仍使用同一组件紧凑投影。无公共API、数据、LLM调用或持久格式修改，非UI正向测试不适用；构建和类型检查只作工具验证，不能代替视觉。

## 实施前方案

1. 新独立before/after不可变publication，端口18621/18623，复用成熟413 NativeService/ProcessFacade、600秒物理期限、完整auth/models绑定与真实gpt-6.1-sol预检。只读现有QA历史，不发送业务、不创建或改写目标。原授权凭据仅私有副本，最终精确退休。
2. before真实首页、已有Work目标创建表单截图，确认入口与布局。UI改动必须以截图观察补充决定。
3. 默认页将无owner Goal引导与输入区放在同一内容区，展示发送需求→创建目标/验收标准/可选预算→查看进度及暂停的明确步骤；开始填写仅聚焦真实composer，不发送或改写内容。真实owner仍只有唯一HTTP Control，突出创建按钮；帮助展示相同步骤及暂停语义，所有新增可见/无障碍内容双语。首页调整宽度、纵向位置、间距和溢出行为，不扩大到移动端。
4. 官方隔离构建后在after真实页面复核默认页、中英文、帮助、聚焦后可编辑草稿、已有Work创建表单及返回历史。不把未提交表单当成真实Goal创建/执行验收。若视觉失败迭代再截图，不用DOM断言或截图比较程序。
5. 自有页关闭，公开shutdown、原句柄join及物理清理，证据脱敏归档、同步三索引/架构、文档检查、范围提交、fresh fetch/merge及完整pending审查后正常push。持续goal保留active。

## Before真实观察与实施决定

18621正式当前bundle截图01确认Goal状态条孤立于顶端，输入和示例居中、上下大块留白；02确认“About goals”竟打开标题为“Create a continuous goal”的无owner说明框，没有可操作创建入口。03为已有原Work上的真实创建表单，未填写/提交。before已关闭自有页并公开shutdown200、原59082 joined exit0。原Provider预检通过，未发业务。

决定默认页移除顶端无owner状态条，把同一ContinuousGoalControl以home呈现放到输入/示例之后，提供三步骤、帮助与仅聚焦输入框的按钮。已有真实owner仍使用同一Control/HTTP数据源；Help无owner时标题改为真实帮助标题，表单补充创建即启用及预算空值的实际含义。首页使用已有page字体角色、靠上有界留白，整体可滚动以容纳说明；不伪造owner或新目标。没有新增后端行为。

## After视觉复核与收尾决定

18623截图04—10证明首页步骤/帮助/已有Work创建表单双语可用；实际点击填写按钮后读取activeElement为chatTextarea，草稿可编辑，未发送。人工检查英文三列发现正文起点因grid默认stretch略错位，已改为align-content:start。首页标题沿用build措辞不适合Work，改为通用完成工作措辞。第一版63秒正式构建已完成体验；仅含步骤对齐的51.87秒构建未publication、不作视觉证据。最终重建50.34秒，使用新verified scope18625重新截图确认，不在运行中的publication换bundle。

切换设置时另看到全局首页General出现config需要project directory的原错误；本批未调查其深层调用合同，作为下一批独立问题，不将空console或Goal UI成功当作排除。before的共享dev.log已在下一次启动后改写，事后读取该时间段为0不能证明零请求；before仅以真实截图、预检和原物理回执资格。after结束时已及时保存原请求事实。

## 最终资格与交付边界

verified 18625使用最终50.34秒正式构建。11/12为最终英文/中文默认首页，英文三列正文对齐，标题改为通用工作；13为原Work真实创建表单，创建按钮突出、明确当前owner及启用含义。14为打开右dock后转到新对话过程的早期截图，dock被正常导航关闭，不能当成打开dock的首页资格；15动画完成但鼠标停留新对话显示tooltip。16/17把真实桌面左栏拉宽，使工作区缩窄，三步骤自动单列且完整可达。18/19首次拖动没有命中手柄，不能作增高资格；读取真实手柄位置后20实际增高输入，21真实滚轮将Goal全部内容与按钮滚入视野。22最终帮助，23回到常规输入和原左栏宽度后的首页。未扩大到移动端/平板。

填写按钮实际聚焦chatTextarea（after只读activeElement观察），草稿可编辑且未发送，清空后恢复既有历史。创建表单只打开和阅读，未提交Goal；本批不宣称目标创建/暂停/自动续跑全链新增资格。UI只用真实交互/截图人工复核，没有新增或运行UI自动化测试。最终overlay typecheck、i18n（两语言2501顶层key）、CSS token checker、官方Node Vite和renderer surface checker、docs:check及architecture-index exit0。首次CSS checker指出自定义line-height脱离公共字体角色，已改用canonical normal角色，原失败日志保留；非UI业务逻辑及schema未改变。

三个scope均公开shutdown200、原59082/24757/99962 joined exit0、native physical/output/request完整结算、auth/models成对退休。每scope两次真实gpt-6.1-sol流预检、200和reader EOF，共6次，无业务输入。额外私有authority两个文件也精确退休；原Codex authority文件尺寸及mtime保持准备前。after/verified原server request只读事实保留，before原共享dev.log时间段未留存，不把空集合当作无请求或无异常。截图、原源码、检查及选定物理回执归档；凭据、DB和Provider完整body不入库。下一批继续查全局首页Settings/General的project config错误，不把该问题包装为已解决。
