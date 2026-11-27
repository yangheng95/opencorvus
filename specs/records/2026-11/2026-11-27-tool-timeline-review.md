# 真实工具调用的分钟级时间线复核

## Recall

- 用户要求本人连续分批迭代，先根因/影响分析落盘、实际修复、真实桌面页面交互/截图人工复核、聚焦正向数据测试、必要的精确openai/gpt-6.1-sol流式任务、范围提交/普通上游合并/正常推送后继续；不使用子代理，不创建额外线程/分支/工作树，不执行发布/tag/PR。配对现Provider凭据及完整模型目录已授权，请求不限，不刷新或泄露凭据。
- 上批8a95f4f71049fe73359d3c58112518afc331b235已修Notebook具名标准流导出，实际14762字节失败原件和14674字节三份成功下载/复制保留；34项格式测试及真实页面通过，原push48478明确join退出0、实际远端/本地/上游一致0/0、暂存空，原177项状态保持。run79正常退出/排空、配对副本退役，自有页面关闭。run78原输出丢失限制已如实记录，不重报为观察到join。
- 本批以原笔记本真实7个tool调用的已保存state.time开始/结束时间作来源，只投影id/tool/time/真实退出码及明确来源说明，生成临时只读JSON供真实模型read。不是销售订单发生日期，不推断等待间隔原因/并发/模型用时；首尾跨度包含空档，不代表连续执行。保留原项目23文件、全部旧行和样本Git身份。
- 已读当前TimelineArtifact、schema point/range/background与group/viewport合同、唯一CSV导出、artifact-timeline局部Moment语言、当前架构主题/首绘/语言/原时间合同；已读2026-10-05选择配色及2026-10-27计划时间线记录。旧批修选择/显式viewport首绘/语言与状态保留，实际多日计划，并未覆盖分钟级真实调用的适应范围。不得重修其已成立合同。
- 全仓定位到唯一vis-timeline构造器/fitAll实现。现fitAll手算时间极值并强制span至少86400000毫秒，实际可缩放下限zoomMin仅60000毫秒；这是几分钟调用可能被映射到数小时视口的源码线索，尚无本批实际失败画面，不先改产品。所有Work/Task/Mission/成员产物共享此renderer与Frame。
- 已查[vis-timeline官方方法与选项](https://visjs.github.io/vis-timeline/docs/timeline/)：公开fit负责将全体item适应当前窗口，支持animation；zoomMin负责原库最小范围。当前安装8.5.4类型公开fit(options)，须继续核对当前库实现和真实页面，优先成熟库primitive（基础能力）而非新手算策略或并行视口状态。
- 本批只操作自有服务/Chrome隔离页面，不动用户窗口/进程或Office鉴权窗口。继续computer-use与benchmark-debug-template技能，不新增/运行UI自动化；数据checker和类型/构建仅辅助，必须实际交互与截图。

## 初始调查与验收方案

1. 新run80继承正常退出run79；三项分别预检凭据可用/完整目录投影/实际精确Sol流式。临时来源文件由上批实际工具part投影，核对其真实起止/退出码，禁止包含完整会话、模型推理或凭据。模型实际read该文件后自然publish原生timeline@1“笔记本核对｜真实工具时间线”；禁止修改项目/pyc、另建Task/Mission、分派、提交或推送。
2. 使用真实read结束点、Bash及发布起止区间、原声明三分组；总跨度若使用background必须明确“含间隔，不是持续执行”。不设viewport，观察默认适应；原生选择失败/成功/校正发布、放大/缩小/适应全部、展开/关闭和中英主题。实际下载CSV，以真实API/schema/生产导出及原时间记录核对全部事件身份/内容/原起止/分组，不凭模型自述。
3. 若复现，补充可观察现象/直接触发/控制数据流根因、旧路径遗漏、所有定义调用/公共合同/数据测试文档交付风险，完成分析后实施。任何调度/队列/唤醒/恢复/终态异常立即横向审计共享执行机制，不把时间线可视范围错误误作执行异常。
4. 改动后新bundle/服务原生复核同产物，保留原选择/原始时间/初始显式viewport与日期语言合同；纯UI行为禁止自动测试，若新增非UI数据逻辑则需聚焦正向测试。保护项目/旧行、关闭自有页面/服务、join原句柄/审计排空/副本退役，更新当前架构与三个索引/声明文档检查，清晰提交、fresh fetch/普通merge/完整待推集合审查/正常push/join/实际远端核对后继续。

[本批证据](../../artifacts/2026-11-27-tool-timeline-review/README.md)。当前为调查与验收方案，不提前宣称缺陷或修复成立。

## 实际发布前调查（尚未改产品）

- 新基线保留23文件/2258旧行（383消息/1148部分/349请求/349结果/29产物）。来源实际7次调用首尾524057毫秒，UTC时间逐项从原API捕获投影，不涉及完整数据库导出。run80三项Sol预检通过。
- 真实Work ses_hFhCAUIlbrIFM2TWtbRi实际read97行来源后finish=stop，仅有read工具调用，模型声称发布接口只支持point/range并据此未发布background。该自述仅为线索，不当作接口事实；原生页面已截图。现生产PublishInteractiveArtifactParameters与ProviderSchema.input在精确OpenAI模型投影下确实保留point/range/background三分支，并接受源8事件合同；因此尚无参数缺失证据，不改schema或宿主工具路由。
- 当前共享renderer selection简述为dated points/ranges/groups，略过background，而实际schema包含它；是否导致本次误判断未知，不能仅凭模型自述写根因。后续在自有运行器最小观察实际出站请求，仅保留publish_interactive_artifact的公开description和timeline参数分支，不保存prompt/headers/凭据/全请求，原请求原样流式转发。真实对话反馈已核对参数事实，要求重新检查当前工具并尝试实际发布；不通过宿主合成调用/消息或替换模型输出。
- 当前安装vis-timeline8.5.4的fit实现调用getItemRange，计算实际项目边界和标签宽度余量，交由Range.setRange应用现zoomMin；单一point使用库现moveTo语义。现手算fitAll忽略标签宽度且至少一天。只有实际发布/截图后才决定适应范围修复。
- 定向测试文件搜索得到fixtures/timeline-order.ts，实际是消息/part/board的排序键和身份数据构造，非TimelineArtifact/DOM/组件/截图/浏览器fixture；不删除这种无关纯数据辅助、不运行其调用测试。当前目标UI自动化测试未发现。

## 适应范围的已证根因与实施影响

- run81实际出站publish工具timeline.oneOf包含point/range/background，精确gpt-6.1-sol/stream=true；同一真实对话反馈后自然调用prt_g0VcAcaAF00SfLnJVAZU成功，产物art_g0VcAcdBO00Cufd05Hql，finish=stop。实际8事件与源id/标签/UTC起止/三分组完全一致，生产schema及发布输入/persisted payload核对通过。原“接口不支持”判断是未实际调用的模型判断，非参数缺项，未证其与短描述遗漏的因果关系；本批不修改schema/工具路由或宣称已修模型可靠性。
- 原生页面初次呈现和点击“适应全部”后，8分44秒来源在16点后至22点后的小时刻度中拥挤，四个真实区间为无法辨读文字的细线；展开同样。before-timeline-fit/expanded两张原图已人工查看。实际CSV下载980字节，数据本身完整，不能用数据正确掩盖不可用的视图尺度。
- 直接触发是无viewport首次绘制及显式Fit all，两者调用唯一fitAll。数据流从源items计算first/last，再Math.max(last-first,86400000)，固定8%/18%边界放大到约6.4小时；即使事件仅几分钟仍使用一天padding。它没有利用库根据标签实际宽度的布局边界。旧计划时间线跨日，初始首绘/语言/选择虽已根治，但无法覆盖这一分钟域错误；不用旧通过降级新真实失败。
- 所有生产入口的同一TimelineArtifact共享point/range/background、分组/无分组、普通/展开及Fit按钮；显式viewport初次仍以作者原视口为准，用户Fit才适应全体。语言setOptions/选中ID/原payload和CSV持久时间没有依赖手算值。此问题是UI几何范围，不是任务调度、并发、队列或终态；已有真实Work stop、全部工具完成、流排空证据，不扩大为执行器异常。
- 唯一实施方案：删除手算极值/一天最小跨度/固定padding，fitAll直接调用现vis Timeline.fit({animation})。使用公开getItemRange/Range既有边界、标签宽度和现zoomMin/zoomMax语义；不增加手算fallback、第二视口信号、隐藏状态、定时器或新配置。保留现首次范围settled→redraw连接、ResizeObserver、显式viewport、日期语言/选择与销毁。
- 风险与验证：库对单point有其原生moveTo语义，可能保留用户缩放范围；不作未实际验收的单点/多年/跨时区承诺。本批原8事件/三种类型在新bundle服务中真实复核，操作选择/缩放/Fit、展开/关闭和英语深色，下载原980字节及Copy须保持；新纯UI范围调用不加自动测试。类型/构建/文档支持，实际原图决定可读性。无schema/API/持久格式/配置改变，不需迁移。

## 候选复核后发现的详情精度与同批补充方案

- run82新bundle自动呈现18:23–18:32分钟刻度，原8分44秒数据不再压在数小时范围，来源点和发布区间可辨；原生点击短失败区间成功，详情显示“2026年11月27日18:23–2026年11月27日18:23”。实际原起止为10:23:37.272Z/10:23:43.892Z，相差6620毫秒；candidate-timeline-detail-precision原图已人工复核。范围候选有改善，但这张图不能作精度最终通过。
- 全仓搜索唯一createArtifactTimelinePresentation和formatDateTime调用：当前日期helper的Intl.DateTimeFormat使用timeStyle=short，将秒省略；point/range/background选中详情共用此helper，而轴刻度由原局部Moment独立负责。持久start/end和980字节CSV原UTC时间完整，缺失仅在详情表现，非数据损失/时区转换或调度异常。旧多日计划详情只验分钟，未覆盖同分钟短区间；native fit修复不改变原formatter，因此不可能根治该现象。
- 同批补充方案：只把现Intl详情时间样式调整到medium，显示本地化秒数，沿现locale和浏览器本地时区；不重写源时间，不改轴、自动缩放、持久数据或增加平行formatter。所有共享入口与三种选中事件获得同一精度。毫秒继续由原UTC来源/导出保真，界面不承诺毫秒精度。
- 新增纯日期数据正向测试：以本地构造的两精确时刻转换ISO输入，断言中英文明确的37秒/43秒输出，避免依赖测试机时区或镜像实现重新计算期望；无DOM/组件/文案源码断言。现仓库已无该helper旧测试，定向/全packages测试检索均未找到，不保留旧分钟断言。现详情flex布局未预设固定宽度，增长的日期正文须在最终中英真实画面复核，证据不足不凭类型通过。
- run80/81/82均已正常退出并join原56935/50155/38878退出0；run81关闭时真实memory流仍在推进，正常排空23.5秒后EOF，不是卡死或终态异常。新增bundle完成后run83重看同产物/两种语言主题、选择/缩放/适应/展开和真实CSV/Copy，所有2258旧行/23文件继续保全。

## 最终真实复核与交付范围

- 最终纯日期数据test:unit为2通过/2断言，分别明确中文和英文37/43秒输出；typecheck原95531退出0，build56.03秒、原53114退出0及renderer public surface通过。范围中间候选59.05秒/原26940退出0的画面单列，未当作精度最终通过。当前docs:check353操作/26组与architecture-index20文档通过；无UI自动化、组件/DOM测试或源码文案断言。
- run83精确Sol三预检通过，新bundle开发/ui/重开同一真实产物。最终8张accepted截图均人工查看：适应全部为18:23–18:32分钟域；原生点击失败区间详情18:23:37–18:23:43，成功区间18:23:51–18:23:57，源范围6620/5520毫秒均有可区分起止秒。真实放大/缩小/Fit后选中保留，展开同一原实例；短区间文字随真实宽度裁剪时，点击后的完整原标签与详情可读，不伪称全部区间文字均完整嵌在条内。
- 实际设置切换英语/深色后，原选中成功事件保持，英文详情6:23:51 PM–6:23:57 PM；原生选择重读原件时间点显示6:30:51 PM，再选来源校正发布区间显示6:30:54 PM–6:32:11 PM。原中文标签和三组/背景声明保真，当前日期刻度使用英语；未改用户/模型原文或推断间隔原因。
- 修改前实际CSV、候选浅/深色两次下载及原生Copy四份均980字节、逐字节相同并等于生产导出。独立Python CSV解析确认8行原五列的id/content/start/end/group逐值等于实际源投影；kind由canonical payload保有，毫秒UTC身份完整。全部源8事件、publisher输入/持久payload、原23文件/2258旧行/样本Git/SQLite最终通过。
- Copy首次locator点击后读取仍为上一批14674字节Notebook剪贴板，原checker明确失败；第二次locator点击也未观察到Copied，未包装为复制通过。追加原生AX（Accessibility，无障碍树）点击实际Copy text按钮后界面明确返回Copied，剪贴板980字节CSV，重新跑原checker通过。早先错误内容保留私有原件，copy-feedback.json记录此前失败与原生成功，未把工具输入方式差异归为未证产品复制缺陷，也未修改共享Copy实现。
- run80/81/82/83总14次gpt-6.1-sol请求全部HTTP200/stream=true/reader settled/EOF；最后原64404也明确join退出0。四个自有服务正常排空且配对auth/models副本实际退役，原56935/50155/38878/64404均已观察退出0，自有页面241805022/026/030/034/044关闭。无子代理、Task/Mission、调度/恢复/终态异常、发布或标签。
- 本批最终范围：唯一Timeline原生Fit调用、现日期表现helper秒数、其正向纯数据测试、当前架构、Recall与13张原图/实际源和导出证据及三个索引单链接。保持原177项无关状态。未新增单point/多日/显式viewport/跨时区原生验收承诺，源码保留其合同；毫秒留在来源/CSV，不宣称详情显示毫秒。后续普通提交/fresh fetch/merge/待推集合审查/正常push/join/实际远端核对以Git事实及私有收据为准，不提前写推送成功。
