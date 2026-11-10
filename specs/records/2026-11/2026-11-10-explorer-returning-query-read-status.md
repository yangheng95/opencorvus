# 文件搜索返回旧查询文字时保留正确加载状态

## Recall

- 用户要求本人独立持续分批迭代，不用子 agent；先并行实页与代码调查、落盘根因和影响，再实施、真实桌面手工交互和截图人工复核、聚焦正向验收、范围提交、合并最新上游和普通推送。上批 `571e983d5` 已正常推送，0/0，177 项无关工作区状态逐行保留。
- 已读 `FileExplorerPanel` 查询与递延查询、`searchSource`、`createResource`、`currentSearchResult`、加载/错误/行、方向键、刷新、查询作用域重置和重试；现 GET `/find/file`、`apiJson` 公共归属、两语言原加载与空态、07-panel、[搜索方向键](2026-11-09-explorer-search-keyboard-entry.md)、[根读取优先级](2026-11-09-explorer-root-error-priority.md)及[读取重试](2026-11-09-explorer-read-retry-focus.md)。全仓搜索 `searchResults.latest` 的查询比较和 `currentSearchResult` 定义/消费者，受影响分支只有 Explorer。未发现此路径的界面自动化；现服务端 `find.files` 合同测试为真实正向错误映射，不改它。
- 验收：真实开发 `/ui/` 英中桌面，先接受 `orchid`，改 `quartz` 并扣留，再改回 `orchid` 并扣留；新请求有结果前显示原加载，而非空结果；放行新的 `orchid` 后显示原精确文件，较旧 `quartz` 即使后到也不替换。真实 `mercury` 零匹配、原重试和箭头进入/回车打开当前文件、清空回原目录保持。后端实读两项/零项及文件内容，零模型。

## 实施前证据、根因与影响

基线实际 `main-BsNlTMTK.js`，隔离文件 `readback-orchid.txt`、`readback-quartz.txt`，真实 `/doc` 声明 `find.files`。直连查询分别返回各自一个原路径，`mercury` 返回 `[]`。桌面先查到 `orchid`。原 `quartz` 200 `5deb6c04-8773-4dc7-b512-ef865d1c5f8c` 等待时显示 Loading。改回 `orchid`，新的 200 `15884811-bf89-487e-ae82-86fe6b8173a8` 尚在扣留时，页面提前显示 No matching files，用户仍聚焦 `orchid`。5.914 秒后完整放行 23 个原字节，实际显示 `readback-orchid.txt`；这与真实接受零项时的 `mercury` 外观相同。更早一次长扣留触发 `TimeoutError: signal timed out`；与短扣留的误报区分，未据超时推断数据为空。[证据](../../artifacts/2026-11-10-explorer-returning-query-read-status/README.md)。

根因是 `searchLoading` 直接比较当前或 latest 结果的查询字符串；两次 A 文字相同，但当前项目、查询源对象、连接授权和选择轮次构成的读取归属以最新 `searchSource()` 为准。`currentSearchResult` 已正确拒绝旧 A，列表无可呈现行；加载分支却把旧 A 文本当作新 A 已有结果，于是未接受的数据被显示为空。原方向键、选择和写操作已用正确 reader 或资源加载保护，旧方案没有统一等待显示。冷读、串行搜索、重试同一个当前 source、清空、切项目或连接均沿原现路径；只有搜索显示的等待分支使用这条文字捷径。代理证明真实重叠读取各自返回正确，当前最终接收正确，无服务端队列、调度、请求路由、重启恢复或 Task（任务）/Mission（多步任务）/Session（会话）执行轮次/终态异常。搜索目录与文件打开使用相同现项目边界；复核项目/权限范围重置和各入口，没有新增持久投影或改变服务和模型。风险是旧请求提前显示零、同一来源刷新时把有效反馈替换为加载、后台目录读取影响搜索或提前移焦；使用原归属读者及手工真请求验收。

## 实施方案

让 `searchLoading` 使用同一 `currentSearchResult()` 判断当前查询源已有可呈现结果。保留 `deferredQuery` 和 `searchResults.loading` 原边界，现 `rows`、错误诊断、真正零项、同来源重试、方向键及清空的唯一实现不变，不新增状态或文案。真实响应采用短扣留；用手工先放行新 `orchid` 再放行旧 `quartz`，核验两种语言、实际文件打开与真实零项。读回源、查两个隔离库与服务正常关停，类型/渲染/语言/样式/文档检查。纯界面改动不新增或运行界面自动化，GPT-6.1 Sol 不涉及。

## 最终验收

- 最终桌面 `main-espW9Dc7.js`。英文等待中的新 `orchid` `e7a07e9a-e9bb-48d8-8cbf-a18f8c0c1ccb` 显示 Loading，保留搜索框焦点。扣留 4.816 秒后交付完整 23 字节，真实页面先显示 `readback-orchid.txt`；此前发起的 `quartz` `69530f07-5c41-4b14-a271-d84864aefae3` 再晚 8.243 秒交付完整结果，页面仍是同一 `orchid` 文件。简体中文新请求 `65494f2f-02c5-40dc-b860-d4bbc26c5a9d` 显示「加载中」，等 4.860 秒先交付；较旧 `8d853f93-c52a-4146-8c46-0496f3c369aa` 晚 7.886 秒交付。中文同样保持当前文件与搜索焦点。两种语言都只有真正的 `mercury` 零匹配才显示空态。
- 键盘 Down 到真实当前结果，Enter 打开 `readback-orchid.txt`，目视看到原文 `Isolated orchid search readback.`。另一次真实 `orchid` 读取截断 `931441e8-d16a-4d23-9ac1-560346b3a25e`，原错误与可展开 `SyntaxError` 保持；真实 Retry 恢复查询及原焦点，Escape 清空回真实目录和两个合成文件。本人目视复核七张基线和九张候选图；有完整本机目录的原图仅留隔离目录。[证据和公开回执](../../artifacts/2026-11-10-explorer-returning-query-read-status/README.md)。
- 直接核验真实 `/doc` 中 `find.files`、`file.read`，候选前后各三次搜索、两次文件读取及原文与磁盘字节对应；提供方连接为零。两个隔离库快检通过，会话、消息、执行任务、提供方用量/活动和权限台账均为零。两个隔离轮次均正常退出且端口关闭。Overlay 类型、双语、样式、构建及渲染、文档检查通过。未改文件内容、模型、服务契约或发布版本。
