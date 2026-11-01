# 工具结构化内容阅读（881）

## Recall

用户要求只使用一个agent（代理）持续自主发现并修复全局UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能问题，真实页面体验后提交推送；不操作用户正在使用的窗口。本轮不委托，不重复修复已解决的Rendering闪烁；持续Goal保持active。登录874已由原owner（所有者）正常刷新，原认证/完整模型目录配对验证，此轮不再次刷新或调用模型。

上一轮880有实质进展：a86511ea513b9279f42505a3ec28e1d6eee0eb21已正常推送，fresh同步HEAD=origin/main，0/0；28个工具显示键及名称单一owner已交付。原native句柄39218/40203均exit0、公共shutdown200、四份配对副本退休。其after完整资格为schema9、92表、258673行、100项目、229附件、累计1260请求。本轮从该闭合合格数据继续，工作区177项无关视频/产物删除、索引与缓存保留。

原图11/12真实成员窄栏的artifact_publish输入显示artifact_type被拆成artifact_ty/pe；14真实主记录artifact_read输入显示“1 fields/1 items”。它们是上一轮实际截图中发现的现象，而非测试夹具或按标题推断。验收要求：同一真实产物参数在窄成员栏可连续读完常见字段名，宽主记录仍便于名称和值对应；嵌套数组、长值、原始内容、展开/收起及复制完整值仍可用；英文零/一/多计数与中文计数符合当前语言。实际页面没有的数量案例明确为未覆盖，不制造消息。

已读：AGENTS.md；880 Recall/完成规格、14张人工复核原图与after-qualified/fresh push回执；当前07-panel的有界/全文工具内容合同；ToolPayload及其唯一直接生产调用者InlineToolPart的输入、元数据、普通输出、实时命令输出入口；conversation-ui的既有展开/阅读位置owner；messages.css全部msg-tool-payload/field/object规则及全局overflow保护；i18n.tc、en-US/zh-CN对应键；现有file-review和其他named container（命名容器）用法。读到的mcp-app-payload-contract及880已核对的i18n加载/目录测试均为协议/资源正向契约，没有UI渲染、DOM或产品文案断言，未运行。

全仓搜索：tool.items/tool.fields只有ToolPayload一个生产调用点和两份当前字典，相关样式只有messages.css一个owner；InlineToolPart被主/侧聊/成员共同使用，没有另一结构化查看器需同步。字段key/value原文、JSON（JavaScript Object Notation，结构化数据记法）解析和复制都由原value驱动。本轮没有相关UI自动化测试需要保留或执行。

## 修改前根因与影响分析

- 直接触发：.msg-tool-field在所有宽度固定grid-template-columns为28%/剩余宽；外层允许任意位置换行。实际窄栏内容区将artifact_type的最后两个字符挤到下一行，值却仍占独立右列，增加对照负担。嵌套对象行已用:has单列，但普通字段不随自身区域宽度调整。
- 数据/控制流：真实持久Tool输入经InlineToolPart完整读取并序列化为ToolPayload.value，组件解析为原结构并递归渲染dl/dt/dd；布局问题在最终共享CSS，不来自模型输出、数据库或Sources。数组/对象计数用t字符串模板固定“items/fields”，没有调用现有tc的one/other接口；语言目录与调用必须同时替换。
- 旧路径未根治：880只修共享操作名称，明确保留真实参数字段；没有修改查看器字段布局和计数。保留原技术key是正确事实合同，不应靠翻译/缩写/隐藏字段或截断值遮蔽排版问题。
- 范围：ToolPayload计数改用现有tc，同两份现有键改为one/other对象；messages.css在现有payload区域建立命名inline-size容器，区域窄于40em时普通字段按单列上名下值排列，宽区域保持现有28%对照。使用已有CSS（Cascading Style Sheets，层叠样式表）token，不新增JS尺寸状态、observer、镜像结构、路径匹配或第二实现。嵌套对象原单列合同继续生效。
- 权威依据：查阅[CSS条件规则规范](https://drafts.csswg.org/css-conditional-5/#container-type)，inline-size容器只按自身行内轴建立尺寸查询；命名查询选择匹配祖先，em条件依赖该容器的计算字体。仓库已有命名容器方案，因此按实际显示区域而非全局窗口断点处理；40em为本组件阅读布局选择，必须实页验证，不声称规范规定该值。
- 风险：inline-size containment（行内尺寸隔离）影响固有宽度；窄栏单列增高可能影响原生滚动/全文和阅读位置；父/嵌套对象不同布局可能挤压；字典string→plural object必须一次替换所有调用，不能保留兼容双源。通过实际主记录与成员的宽窄、嵌套、原始/可读、滚动、全文/收起、复制和中英文验证。未测分支明确记录。
- 不适用：不改持久格式/schema、Tool参数/结果契约、调度/队列/唤醒/恢复/并发/重试/终态、Provider或模型权限/请求、Sources身份或内容。不发现真实运行异常就不按历史标题推测调度故障；若出现异常立即按AGENTS共享机制横向审计。此轮不更新版本，不创建Release、tag或PR。

## 首次资源与落盘实施方案

before/after各首次0个Provider请求，共用首次prepare前声明75分钟绝对截止，保留5分钟正常闭合；不提高额度、不重启已有阶段、不延长截止。复制880-after完整已合格数据库及附件命名空间，保护全部100项目业务文件/Git及229附件。原认证与完整模型目录配对复制、验证和退休，不输出内容。before复用880最终真实构建main-Od53X_nA.js及ui-build-final-attempt2成功回执；after用Node.js真实构建。项目CLI开发模式/ui/，本人后台隔离端口38579/38580，不碰用户18571或其他应用窗口/进程。

1. 真实before打开Task801，选原base-tester成员，展开5操作组与artifact_publish输入，截图窄栏字段；主记录artifact_read输入截图单数与宽布局。正常退出本人页面和服务，原句柄exit0/物理与输出/请求结清、配对副本退休、完整数据资格。
2. 按上述唯一owner修改计数/双语和CSS布局，07-panel补当前合同。纯UI修改不新增或运行任何自动化UI、文案/源码、DOM（Document Object Model，文档对象模型）、组件、快照或像素断言。
3. after真实同一记录复核窄栏字段名/值、嵌套数组和长JSON值、raw/可读、展开/收起/滚动，以及宽主记录。真实复制粘贴仅为未提交草稿，验证后清空；不从适配器剪贴板读值单独推断产品结果。切中文复核原字段身份/计数与来源预览；实际原图人工查看，再按视觉结果调整。
4. Node构建、类型、双语/样式/docs检查只作辅助。每阶段原公共shutdown200、原native句柄exit0、出生身份物理/输出/请求结清、配对副本退休，完整旧行/全部项目文件与Git/附件/来源DB/原认证与模型目录保护。三索引同步，本轮字段/文件范围清晰提交；fresh fetch/普通merge、完整待推送集合复核、正常hook/push和随后fresh同步。

## 实施与实际结果

before真实38579页面：01主区域artifact_read完整输入实际显示“1 fields”“1 items”，上方搜索结果两处空数组显示0 items；02原base-tester侧栏artifact_publish六字段中artifact_type确实拆成两行。只读尺寸辅助为payload327px、内容325px、实际列84.2656px/204.734px，key宽84px、高33px、行高16.5px；原图已人工查看，不以尺寸代替视觉证据。

关闭本人页面并public shutdown200，原native句柄6517 exit0、出生身份物理/输出/请求结清、两份配对副本退休。完整资格258673→258675行，只增加一对正常控制租约记录；schema9/92表、全部旧业务行、100项目文件/Git、229附件、源DB及原认证/完整模型目录保留，零文件系统豁免；实际0请求/累计1260，闭合余量4401794毫秒。

按方案完成五个当前文件改动：ToolPayload使用tc，双语现有两键直接替换为one/other对象；messages.css在同一payload建立命名行内容器并以40em切换字段单列；07-panel同步当前合同。旧普通t调用与字符串目录已同步删除，没有fallback（后备路径）、另一份状态或兼容实现。Node构建main-B2xPlHX1.js原句柄20908 exit0；Overlay类型、2744项双语、现有样式token与352规格/26架构文档检查均exit0。after实页和完整闭合结果随后按实际证据补记。

## 最终真实页面与数据资格

38580本人后台页面使用同一Task801和原base-tester记录，13张原始JPEG均已实际呈现并人工查看，见[证据](../../artifacts/2026-11-02-tool-payload-reading/README.md)：

- 03英文主区域显示1 field/1 item，实际空数组0 items、多字段3 fields均正确；没有制造数量样本。04成员327px payload中artifact_type由原84px名称列/33px两行，改为301px整行/17px一行，实际字段名和值上下对应；原base/test-report、版本1、作者标题等事实保留。
- 05实际拖宽本人右栏到界面允许的上限，payload420px仍低于40em，继续单列；这张不作为宽双列通过。10关闭右栏后的真实主区域payload747px，complete/true恢复201.875px与507.125px两列对照，0 items/1 item/4 fields同时可见。主区域因为右栏打开而变窄时也按自身宽度单列，并不绑定侧栏身份或全局窗口大小。
- 06展开原source_read_refs的15 items，07切换到完整原始JSON。08点击复制输入后原生Ctrl+V粘贴到主输入，实际8113字符、6个原始字段、artifact_type=base/test-report、15条来源引用，随后清空草稿，Send回到禁用；没有发送消息。复制值与880的真实结果一致，不重构结构化显示文本作为复制内容。
- 返回可读视图后原15项仍处于展开；09通过实际阅读尾项14，完整尾部引用、resource_set和后续长payload_json均可达，未截断/翻译key或value。原始/可读、顶层全文收起再展开均正常，嵌套展开状态保留，未增加另一份阅读或结构状态。
- 11中文主区域使用0项/1项/4个字段，12成员6个字段/15项及完整artifact_type原名可读。13从实际成员来源按钮打开test_counter.py，应用内文件面板读到原15行源码及两个原测试；没有编辑或执行历史命令。所有操作均在后台独立页面，没有创建系统全屏窗口或操作用户应用。

after关闭本人页面后public shutdown200，原native句柄57074 exit0，出生身份物理/输出/请求结清，两份配对副本退休。两阶段实际0模型请求/累计1260；完整资格258673→258675→258677行，每阶段仅正常控制租约记录各新增一对，schema9/92表、全部旧业务行、100项目业务文件/Git、229附件、各来源DB及原认证/完整模型目录均保留，零文件系统豁免；after闭合余量3937376毫秒。没有对用户数据库执行构建、迁移或网页验收，没有唤醒历史工作。

边界：实际覆盖空数组、单字段对象、单元素数组、多字段和15项；零字段对象未单独实页查看。没有模型调用，因此实时流式输入与每个其他ToolPayload入口未逐一实页验证；共享调用、原有实时有界/完成后全文合同已代码审计，未更改高度或数据流。没有新增/运行UI自动化、源码文案/DOM/组件/快照/像素断言，尺寸仅为真实截图的辅助观察。版本、后端、权限、持久格式和调度合同未变，不发布Release/tag/PR。

本轮字段与文件独立提交，fresh fetch/普通merge、完整待推送集合复核、正常hook/push与随后fresh复核以实际原句柄和回执为准。持续Goal保持active，继续单agent排查。
