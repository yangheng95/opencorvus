# 设置搜索方向键进入真实匹配

## Recall

用户要求持续按批推进直至明确停止，最新要求本人独立不委托。先根因和影响分析落盘、真实桌面与人工截图、聚焦正向检查、清晰提交及正常推送。前批 `1c1c45d96` 推送正常，HEAD 与上游 0/0、原 177 条状态逐行一致。GPT-6.1 Sol 授权仍待用户答复；本批不读取凭据、模型目录或执行模型。

已读 ConfigDialogHost 的查询、活动页保留、侧栏分组、Tab ID、现 owner 与关闭/返回焦点，SearchField 原扩展点、共享 Tabs 的 manual（手动激活）、CONFIG_SECTIONS 当前组合词元数据、text-search、config-dialog-control、07-panel 设置搜索，前批设置组合词和资源管理器键盘入口规格。全仓确认当前仅设置侧栏与命令面板使用同一设置目录搜索事实；两者列表和焦点 owner 不同。[W3C 手动选项卡模式](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)说明原方向键移动与 Enter/Space 激活语义。没有找到涉及路径的界面自动化；现 text-search 测试是正向纯数据，但本批不改其算法。不新增或运行 UI（User Interface，用户界面）自动化。

## 根因和影响分析（实施前）

候选：输入设置查询已显示匹配项，但方向键停在搜索框。当前 SearchField 有 `onKeyDown` 扩展点，但设置只接 `onValueChange`，默认处理清除/Escape，输入框没有结果焦点入口。已有 Tab/Clear/当前页/方向键路径能显式打开，且当前页需要按架构保留用于继续输入；不能把当前页保留误当查询结果，也不能在输入时自动换页。待以实际键盘、焦点和可见截图核对。

若实证，复用 SearchField 现事件，处理非空查询、非组合输入、无修饰且未消费的 ↑/↓，只焦点到本次真实匹配的末/首已挂载选项卡。顺序取当前侧栏真实渲染顺序并以既有匹配 tab ID 判定，因 CONFIG_SECTIONS 的注册顺序不等于分组侧栏顺序；不加平行排序、影子查询或待焦点 owner。排除仅为保留当前页的选项卡，但当前页实际匹配时照常纳入。焦点事件不改变已选页；继续按原 Enter/Space 激活，原 Tab/箭头/Escape/清除不改。无真实匹配时保持输入和状态。在有匹配时给当前语言的短键盘提示，与输入的描述关联，实页核对不占据导航。

影响面仅设置查询到实际 rail 的键盘焦点与语言提示。匹配算法、索引、共享 Tabs primitive（基础组件）、显式选择、表单所有权、API（Application Programming Interface，应用接口）、持久数据、权限/执行/模型均不改。风险为错误聚焦仅保留的页、跟随注册而非视觉顺序、误触发输入法组合/修饰键、在无结果时抢焦点、破坏原页面或可见导航。没有执行轮次/队列异常证据。输入法与跨浏览器无法实际时须明确，不注入合成事件。

## 验收

Temp b52 隔离 before/after Git 项目/profile，真实开发 `/ui`。旧版 General 实际查询 `language appearance`、按 ↓ 观察输入焦点和页面；用正常 Tab/方向键到原匹配并 Enter，证明原选项卡正常。改后以当前真实结果为准，多项查询 `skills` 验证首末（实际侧栏顺序，原 General 仅保留）；明确按 Enter 打开前不切页；单项、中文 `代理 网络`、无匹配、Escape 清除和可见焦点。仅导航 Network，不输入、保存、测试连接或改代理；保持用户进程和凭据。真实截图本人查看，若初版提示位置影响读图则先记录再调整；类型、双语、普通构建及 docs/架构辅助。实际当前项目/列表响应按运行时 schema，原 Git/空会话、消息和任务事实核对。自有页和服务正常关闭并消费退出，范围仅产品实现、两语种提示、必要局部样式、当前架构及证据索引。

## 真实前态与实施定稿

39025/IAB116 实际 General 查询 `language appearance` 时可见 General（仅保留当前）和 Appearance（匹配），输入 ArrowDown 后焦点仍为输入、General 正文不变（01）。真实 Tab→Clear→General→ArrowDown 把焦点移至 Appearance 而不切换正文（02）；Enter 确实打开 Appearance（03）。两个实际项目读取 HTTP 200、运行时 schema 与隔离项目身份正确。本人查看全部前态截图，页和服务正常退休，进程退出0。

采用已挂载 rail 的 `data-config-tab` 顺序与真实匹配 ID 交集，避免注册目录先列 Chat/Work 后列 Network/Usage 与侧栏不同而误判边界。只在真实匹配且实际目标存在时消费按键并调用原按钮 focus，非异步；手动 Tabs 仍是唯一导航。侧栏有匹配时显示现语种的短提示并关联原输入，初版局部间距待实页。

## 验收结果

39026/IAB117 最终 `main-CjKBygnj.js`。英文实际 `skills` 匹配 Chat/Work/Mission Skills/Skill Library，General 只保留当前页。输入 ↑ 到 Skill Library、↓ 到 Chat，焦点环可见而 General 仍选中和显示（04–06）。04 是旧设置按钮工具提示暂留在指针下的观测，移到页面空白后以 05 复核完整尾项及提示。继续原行 Down 到 Work，返回 Chat 再 Enter，才打开 Chat（07）。输入 `language appearance` 后 Down 到实际 Appearance，原 Chat 保持到 Enter。

原地切中文，查询「代理 网络」后 Down 到网络，外观仍选中/显示（08）；Enter 打开实际 Network（09），全程未输入网络字段、保存、测试或改代理。无匹配时两方向仍在输入，显示本地化无结果并保留 Network（10）；Escape 清空及恢复完整 rail，焦点仍在输入（11）。当前 Network 真正匹配同一查询时 ↑ 会聚焦该已选项（12）。提示在当前 1280×720 两语言实页清楚，无需再改布局。不宣称实际输入法组合、所有修饰键、读屏或跨浏览器矩阵已测。

两阶段各两项实际 HTTP 200/运行时 schema，当前隔离 Project 与列表的同一记录精确匹配。两份独立 Git 原文件/HEAD 原字节保留，每库 Project 1、Session/Message/engine_task/provider_usage_event/provider_activity_request 0、配置清单空。两个自有页关闭，两个服务正常关停并消费退出0，待结算 Prompt 0。未执行模型或用户任务。

[12 张实际桌面图和原运行证据](../../artifacts/2026-11-09-settings-search-keyboard-entry/README.md)全部本人复核。类型、双语2933键、正常构建50.72秒、渲染器公共面及文档/架构检查通过。没有界面自动化测试。
