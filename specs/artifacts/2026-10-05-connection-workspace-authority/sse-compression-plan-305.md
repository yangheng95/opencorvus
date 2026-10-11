# 305 流式传输压缩

## Recall

用户要求持续自主改善 Sources、Rendering 和功能体验，最新人工约束仅单 agent，本轮无委托。上一轮85bcc029e 已推送、工作区干净；304真实Task成功，4832条字段更新、7738字符正文恢复正确，但公共Task事件流收到53,141,140字节，完整value累计41,749,950字节，原片段仅19,525字节。本轮目标是在保留真实事件/完整恢复及即时流式展示下显著降低传输量。原goal中Astra措辞已被用户单agent指令覆盖。

已读304 Recall、证据及共享server/sse.ts、Task/Session路由、Hono实际安装的stream/compress/accepts实现、Project SSE接收器、当前架构控制面/反应性/运行就绪。全仓检索createSerializedSSEWriter、streamGlobalSSE、streamProjectSSE、compression、Accept-Encoding、Content-Encoding、createGzip、CompressionStream；当前生产server无HTTP压缩。全部共享入口为app两处、interactive-artifact、global、pty、work-ledger、panel、orchestrator、session，共8个路由文件（9个调用点）；历史03-control中5文件清单已过期，本轮同步准确列表。

## 根因、契约与选型

直接触发为每个真实text片段带完整当前value；这是304消除未落盘HTTP前缀歧义的当前契约。重复字符未经压缩被JSON/SSE直接传送，体量随长度增长。删除value、按词修补或仅依赖完整Part会重引入303缺字；丢弃实时事件会改变CLI/SDK原始fragment可见性。保持事件字节语义，通过标准HTTP内容编码压缩同连接重复内容，属于传输能力协商，不是旧协议fallback或第二内容源。

权威资料：Hono https://hono.dev/docs/middleware/builtin/compress ，Node.js https://nodejs.org/api/zlib.html#flushing 和 https://nodejs.org/api/stream.html#streamduplextowebstreamduplex-options 。实际Hono中间件跳过Transfer-Encoding且CompressionStream无逐帧flush配置，不能原样用于当前SSE。采用现有运行时支持的node:zlib流式gzip（Z_SYNC_FLUSH）与标准Web流适配；只在现有HTTP服务边界使用，不把通用业务能力绑定宿主，也不引入依赖。先用私有实验确认当前Bun和Node适配、自然结束和消费者取消均收敛，失败则修正当前实现，不增加平行后备。

统一放在createSSEStream返回Response处，保留Hono的序列化、onAbort及既有AsyncLocalStorage/项目身份边界。按Accept-Encoding的gzip/identity质量协商；复用Hono accepts解析器并明确q=0、大小写、通配符与identity规则。Vary合并Accept-Encoding；gzip时删除Content-Length。不可接受的全部编码使用明确HTTP 406契约，且在创建stream前决定。缺省客户端用标准identity；不修改事件schema、游标、重放、终态或数据库。

## 影响、风险与验收

所有Task/Mission/Standalone/Side Chat/Project及其他SSE入口通过同一primitive；每响应拥有压缩器，禁止跨项目共享字典/实例。新进程及重连拥有全新gzip流，不保存压缩状态。自然关闭输出gzip尾部；消费者取消必须经Web流传播到Hono原stream/onAbort，释放路由订阅；慢消费者沿现有流背压，不能新增无界手工缓存。异常和终态必须在真实HTTP/实际公共路由验证，不用仅mock验证替代。

聚焦后端测试：gzip与identity协商、空/多字节/长正文保持事件字节、第一帧在后续帧释放前可解码、正常尾部、取消清理、错误契约、并发请求/项目隔离、Task/Session真实路由和reconnect。原始TCP读取用node:http取得压缩字节（fetch会自动解压，不能把其body长度误报为压缩后网络量）；真实客户端同时校对原始fragment连续性/完整value/自然终稿。纯UI不新增自动化测试，正常开发服务/ui实际操作Sources、侧栏重开/切项目并截图人工复核，运行授权gpt-6.1-sol一轮记录压缩前后字节及完成时间。复制auth及完整models目录、分别预检、20请求预算、固定时限、精确服务和原exec成对关闭。

需明确保留的限制：压缩降低网络流量，不消除解压后的JSON解析或完整value分配成本。有效性以真实字节和响应行为为证据，不靠可变源码哈希。最后更新文档索引/公共SSE架构、运行当前文档检查、范围提交、fetch/merge/待推送集合审阅及正常push，goal保持持续。

## 当前实验推进：必须修复运行时依赖

实际13项HTTP检查通过，Bun fetch取消/reconnect检查在首帧前3秒超时。进一步独立node:http探针（不经过项目或Hono）证实：当前Bun1.3.14 gzip/deflate/br均等待1200ms直到服务端关闭才交付正文；相同gzip在Node25.7.0约20ms即时收到首帧。多gzip member方案也不能修复旧Bun等待且只读首member，已拒绝，不作为生产后备。

从官方oven-sh/bun release bun-v1.4.0下载Windows x64到任务私有目录，仅核对官方不可变发布资源digest和实际--version；未替换全局Bun。相同原始gzip探针在1.4.0首帧13.6ms。下一步先在隔离1.4.0重跑原14项HTTP验收，通过后升级根packageManager和catalog @types/bun及bun.lock，沿唯一版本配置供CI/本机原生构建使用。全仓检索版本引用并检查安装、类型、共享HTTP/进程收敛与真实原生gpt任务。任何不通过都修根因；不使用User-Agent分流、SDK强制identity或运行时后备隐瞒问题。已运行用户进程和全局Bun保持不受本轮工具实验影响。执行命令的PATH仅在当前隔离检查进程中指定该官方1.4.0目录。

隔离1.4.0原14项HTTP检查通过，27项原流式/Session/replay/Inspect契约通过。安装只更新Bun类型及去掉未被引用的lock条目typebox。类型检查揭示两处影响：新Bun Process.off仅声明memoryPressure重载，原六处标准信号解除因此无法匹配；使用同一EventEmitter标准removeListener解除原回调，不引入新生命周期。新fetch proxy允许URL对象；当前共享ProxyFetchInit结构需完整接纳标准URL及对象url字段，仍按已有配置代理覆盖/原样保留规则。已全仓检索调用与测试，分别补正向代理保留测试并使用Browser MCP Node进程检查核对实际关闭，不运行浏览器UI自动化。

类型根因进一步确认：removeListener同样被1.4.0声明遮蔽，不能靠换方法解决。官方bun-types1.4.2明确补上Node<=24的off/removeListener通用重载（已读发布包overrides.d.ts119–125行），最终改用@types/bun1.4.2，恢复全部六处原始process.off。运行时仍是已验证的1.4.0，类型包仅采用同系列修复；不保留本地声明补丁或unsafe过程转换。
