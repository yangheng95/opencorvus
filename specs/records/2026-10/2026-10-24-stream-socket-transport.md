# 共享流传输修复

## Recall

559继续用户授权的单agent自主体验、修复、真实页面复核和提交推送；不委托。用户确认OpenCorvus已热认证OpenAI，真实Provider验收可以隔离复制auth.json与完整models.json，实际模型必须gpt-6.1-sol；凭据不进入日志、文档或提交。整体持续Goal保持active，旧目标里的Astra要求已被后续单agent要求覆盖。

558提交ede12ee33已推送，第三同源Task页第六条HTTP事件流后普通请求停止42.343秒；独立健康200，关闭一个自有页后56毫秒Markdown worker到达、原页恢复。不同项目Task/Session/Side/Mission也复现35.750秒。13张人工截图、HTTP到达与abort事实在上一批记录。已修复Session/Mission纯历史读取错误的模型启动耦合，但传输根因尚未修复。上一批三个独立服务、七页、原exec/native全部正常闭合；0模型，完整90表169304原行保持。不得操作用户窗口、服务或数据库。

本批起始有大量无关专家团修改、旧素材删除及一个已暂存的engine-evidence.ts；保留全部外部工作，独立精确索引提交本批文件，不能清空外部索引或混入。已读558Recall、07-panel-reactivity连接所有权、HostTransport接口及六个openStream调用、tauri-transport全部流分支、server.ts认证/Origin/CORS/Project准入/停止路径、唯一server/sse.ts及相关纯传输测试。旧传输测试没有DOM/组件断言，属于非UI合同，需按新实现替换；不新增或运行UI自动化。

## 修改前分析与决定

直接触发是每页global work-ledger和selected source占两条长期HTTP/1连接，Side和MCP增加连接；六条占满浏览器同源额度，普通健康、配置和Markdown worker排队，造成Connecting、输入禁用和Rendering。server.listen当前普通HTTP、idleTimeout=0，无HTTP/2/TLS；GET无Auth走EventSource、GET有Auth及POST走fetch长流，两条旧物理路径都占同一有限池。此前修复渲染owner、请求准入和关闭清理没有改变此资源竞争，因此不能根治该路径。此证据不证明所有历史Rendering问题只有同一原因。

全部生产入口：selected Task/Mission/Session、global work-ledger/Mailbox、Side Session、POST panel message、POST VCS commit message、MCP App。业务事件、游标、project lineage、occurrence、持久Task/Mission/Session事实与业务重连仍使用原实现；不改调度、schema、模型prompt或事件写入者。正常/错误/EOF/主动关闭/auth切换/页面销毁/服务停止/重新连接、同与不同项目需横向验收；真实覆盖不足必须列出，不以单页通过替代。

选择WebSocket（双向持久连接）作为UI唯一物理流载体，GET/POST统一替换EventSource/fetch长流；HTTP/SSE公共API保留现有唯一业务处理器，WebSocket只逐字节转发同一App.fetch的原Response，不另建publisher/业务状态/重连。SharedWorker只去重不能解决六个不同source；预加载、轮询、连接分片、延长超时和隐藏Rendering均不能消除根因。localhost HTTP/2需要额外TLS信任，不在本任务引入。

鉴权采用短HTTP准备请求经现有BasicAuth、Origin/CORS；获得有界、一次性、绑定Origin的临时ticket，经WebSocket子协议提交，不把用户凭据写URL。准备阶段不执行目标业务；socket实际打开后原Request再进入完整App.fetch，重新校验认证、Project和执行准入。ticket是传输资源而非domain影子事实，过期/消耗/服务停止时销毁。只接收同服务相对路径，禁止transport自身递归。响应状态及原SSE字节经socket转发，背压等待drain，socket关闭传播原Request abort和reader cancellation。协议定义集中transport-protocol，10秒准备/打开期限单一来源；业务层仍唯一拥有重连。

参考当前官方资料：[Hono WebSocket Helper](https://hono.dev/docs/helpers/websocket)提示升级响应与修改header的中间件冲突；采用底层服务器upgrade，ticket发行仍经过原中间件。[Bun WebSockets](https://bun.sh/docs/runtime/http/websockets)说明send返回值与drain背压契约；实现不得把慢消费者转成无限应用队列。宿主升级胶水位于Server边界，核心读写继续Web Request/Response与stream协议，不增加依赖。

## 实施和验收计划

先共享协议、server临时ticket/字节桥接/生命周期接入，再UI唯一socket适配器；删除旧EventSource和fetch流实现及过期分支合同。聚焦非UI正向真实网络合同覆盖GET/POST原body和事件、多流+普通请求、Origin/认证错误响应、ticket一次性/过期、关闭abort/服务清理及原错误。测试不能作为视觉验收。

使用Node正式UI构建及source CLI /ui，隔离20分钟原生父进程边界、180秒启动无活动、至少五分钟收尾；先多页原历史，再中文Goal入口/布局/Side实际截图，必要真实Sol发送。每次修改UI资产后fresh服务，禁止单独Vite、刷新用户页。凭据与catalog先验证完整投影及实际模型一致，复制后安全退休。关闭自有页、公开shutdown、原exec/native/launcher/output/request/精确出生闭合，全表原字段时间/source字节mtime/schema3/integrity核对。

同步本记录、当前架构和四索引，运行文档/类型/API及相关正向合同，保存真实截图和不含secret的证据。范围清晰提交，fetch/merge upstream、审核完整待推集合、hooks全部通过后正常push与fresh0/0。未验收项如实保留并继续，禁止宣称根因已治或整体Goal完成。

## 实施与真实结果

协议集中在transport-protocol/stream-socket.ts，唯一UI GET/POST适配器替换原EventSource和fetch长流，删除过期分支测试；新纯传输合同移到后端运行器，因为Overlay包没有Hono依赖，不添加错误的生产依赖来维持测试位置。服务拥有ticket和socket reader，原App.fetch继续执行唯一业务HTTP/SSE路由，shared server/sse.ts及原事件writer没有第二实现。Listener停止先退休临时admission和原reader，再走现有停止合同。服务停止早于open时明确1001结束，升级失败和过期消耗均有正向错误输出。

公开准备端点/global/transport/stream有当前OpenAPI说明，涵盖方法/相对路径header、可选JSON/二进制/文本原body、ticket和400/401/503；实际升级使用既有Origin判定及一次ticket子协议。SDK/OpenAPI及中英API文档从同一路由生成，不豁免checker或隐藏过期文档。无schema、版本、业务事件、occurrence或工具权限变化。初次真实Server合同错误预期server.connected，查原work-ledger路由后改为实际work-ledger.connected/sequence0完整对象，原失败保留为测试编写错误，不制造产品补丁。

新传输9项50断言和真实生产Server八流合同1项18断言通过；原准入8项8断言和纯历史读取2项80断言也通过，合计20项156断言。GET/POST原body/query/auth/UTF-8拆帧/空格/多行SSE、正常EOF、八流普通HTTP、原Request abort、真实Hono Basic Auth及轮换、规范404错误、Origin/ticket一次性/到期错误、listener清理和drain逐字节顺序均有明确正向结果。drain合同使用小型通道局部checker，只证明背压接口，不冒充真实网络慢消费者资格；其余网络合同进入实际Bun监听器，生产合同进入Server.listenPrepared和真实work-ledger路由。未运行UI自动化。

Node正式构建main-C7aBtTu6.js，冻结完整资产后fresh隔离source CLI /ui。19167、原exec74775、原生target88696/parent33660，20分钟边界。源为完整正常闭合558-final，schema3/90表169304行。启动前使用用户当前OpenCorvus OAuth及完整相邻models.json，先验证凭据、模型投影与api.id，再通过真实流式预检证明credential usable/catalog projected/actual gpt-6.1-sol；不是只复制auth或凭标题判认证。最大6次，实际4次全部该模型/streaming/200/原reader EOF，未耗尽。两次预检及实际新对话/辅助请求由audit独立观察，不能把它们计成四次人工UI发送。

五页205—209人工打开：三个相同历史Task、跨项目Mission、默认首页。第三页完整正文/在线；成员dock原阅读位置及手动到顶部的来源标题、域名、复制操作、正文均实图复核。第五页默认布局与加号→持续目标原表单正常，Escape退出；实际UI选择gpt-6.1-sol并发送有限不委派文字，收到“多页流传输验证成功。”并恢复输入。第三页追加原Side Session后正常连接。八张图均逐张实际查看，未刷新或重启来制造通过，未触碰用户18571页或窗口。最后前端修改只涉及类型声明/格式化，实际运行语义与所冻结资产一致。

五页阶段记录12条未记abort的规范事件流，其中一条直接HTTP流在首个测试页/ui请求之前出现且没有ticket admission，20:12:22旧实例abort后重连；客户端身份未知。关闭两页后8条，再关闭全部自有页后仅该直接流保留；不能把它称为五页产生12个socket，不能认定新socket泄漏，也不声明其归属已查明。不操作其它客户端，公开shutdown200后所有规范流均有abort，原服务退出0。下一批可在fresh自有观察器加入非秘密Origin/User-Agent和初始signal.aborted事实，追查独立直接HTTP来源，不能改写本次原始观察。

20:20:48正常shutdown，预留661913ms；原exec/native/launcher退出0、physical/output/request闭合、精确出生链dead_or_reused。复制auth和完整models各退休一份，源catalog9155406字节/mtime/内容保持。源DB/90表原行所有字段时间、字节mtime和canonical保持；目标原Task/Mission/Session/Goal保持，Provider活动421→423，真实预检引起memory_chunk原行content/token_count/time_updated、memory_file time_updated和两条runtime_execution_capacity_lease租约字段变化，完整记录在证据中，不宣称目标全表零变化。实际schema3对象及integrity保持，用户数据库未打开或迁移。

当前人工范围不含原生桌面窗口、VCS/MCP真实订阅、POST panel真实模型发送和服务重启重连；它们仍由同一适配器接入且部分非UI合同覆盖，但不能包装为全部端到端已过。根因修复针对已复现的HTTP同源长期连接饥饿，不能宣称所有Rendering问题均已根治。另观察默认新页显示匿名项目但发送后落在此前Mission目录的普通Work会话，需后续核对选择/持久上下文归属，不能凭外观或URL先判根因。

提交前聚焦20项156断言、后端与Overlay类型检查、Node正式构建、api:routes-check（36路由文件/6规则）、docs:check（346操作/26组）均通过。独立索引准备时首次全仓ls-files读取超过Node默认缓冲，只有只读git进程结束；已改为精确外部暂存项备份和有界大缓冲，重跑原暂存/差异检查通过，不修改或混入外部engine-evidence暂存。
