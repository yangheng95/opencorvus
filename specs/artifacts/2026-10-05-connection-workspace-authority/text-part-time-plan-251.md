# 251 流式正文片段保留真实开始时间

## Recall

用户要求持续自主找问题、改进Sources及Rendering，并最新限定单agent；root独立调查/实现/验证，不派委托。250真实历史子Dock来源/完成时间/阅读位置通过，7edc20b8ad8224e31e5907cfe329b8ea19e73fb6已正常推送，起始工作区干净。持续目标未完成，旧goal中Astra措辞不再适用。

249已保留真实完成库的明确问题：Side Message msg_g0VXaByDO0097NwkUzpI 的TextPart prt_g0VXaBzTB00hXUaexz83正文3295字符，time.start=time.end=1791574557272；实际生成前已有Working正文，而Message从created到completed为69809ms。证据为[原完成只读事实](completion-duration-249/live-01/live-canonical-metadata.json)和[当时真实页面](completion-duration-249/live-01/README.md)。本轮不是重新推导Card耗时；Card使用Message/当前activity时钟，249已修该界面契约。验收对象是当前流式正文Part的真实开始/结束事件和持久事实。

已读当前SessionProcessor的text-start/delta/end、200ms全文前缀queue（队列）及settle（等待闭合）、retry cleanup（重试清理）、abort（中止）终态分支和reasoning正常/中止结束；Message.TextPart定义、Session.updatePartWithSignal/PartUpdated（片段更新事件）、MessageStore、protocol replay（协议重放）关闭判定和overlay活动时间读取；当前架构02-data/06-provider/07-panel-reactivity以及247前缀/249耗时决定；现streaming-text-prefix真实TCP（Transmission Control Protocol，传输控制协议）测试、processor-producer-boundary/llm-activity-retry与Task-root多步契约。

全仓搜索SessionProcessor.create生产入口只有loop的普通/Task/子/Mission共用执行、loop持久Tool continuation（工具继续）恢复和compaction（上下文压缩）。其他collectLLMText类调用没有这个TextPart writer（写入者），不适用该时间赋值。全仓搜索TextPart.time消费者：CLI（Command Line Interface，命令行界面）/GitHub输出以end表示闭合，protocol.store同样只以end判定；overlay读取start/end推导活动时刻，外部证据benchmark可读取这组时间。公开TextPart.time仍可选，因为用户/控制正文不必是Provider流；当前processor创建的流式TextPart必带start，不改变schema（数据库结构）或SDK（Software Development Kit，软件开发工具包）定义。

## 深度、影响与根因

观察：长流式正文终态持久时间跨度为零。触发点：生产text-end在已接受text-start、delta、前缀queue闭合和text.complete插件完成后，把整组time替换为两个新的Date.now()，丢掉既有start。reasoning-end与外部中止正文都展开原time并只赋end，说明不是统一时钟策略。旧247前缀修复只处理正文内容持久化和同一queue闭合，未改变自然text-end时钟；249界面时钟也不读取该Part start，未根治数据问题。

影响：全部共用processor的自然完成正文，主/Side/Task/子/Mission及压缩；真实时间证据和重放仍闭合但start失真。end的语义不变，记录仍在当前插件完成后结束。重试每attempt（执行尝试）有自己的Part身份；清理等待同queue、按真实attempt隔离重置currentText，不把首失败attempt开始时间移入新Part。causal（因果）Task-root保留历史Parts的既有清理语义不在本轮重写，测试实际执行其当前契约；进程重启读取既有持久字段，没有额外重建/修复历史时间来源。

这不是已观察到的新queue/调度/恢复终态异常：正常end和中止的事实流已经定位为单一字段覆盖；queue正常join、retry与多Project隔离按当前生产路径复核并聚焦测试，不增加调度机制。若真实检查出现新共享异常立即扩展全部Task/Mission/Session轮次审计。没有回填历史数据、计时fallback（后备来源）、时钟钳制、双写、消息合成、UI（User Interface，用户界面）变更或配置策略。旧真实坏时间保留为前证据，不冒称已经修复历史。

## 方案与可执行验收

先在现有真实TCP Provider/SDK/fullStream/processor/SQLite/Bus测试中增加正向时间契约：运行中已发布Part的start在自然完成、外部取消、双Project并发终态保持；最终Part与终态PartUpdated事件同身份/开始/结束值；短请求和真实断流后重试的成功Part使用自己text-start事件的时间。比较复制出来的数值，不持有会被改写的对象引用；正常持久前缀等待200ms的场景以end>start证明实际跨度，不添加固定sleep（等待）。先运行当前生产实现，保留真实失败，再修text-end只保留既有time.start并追加一次Date.now() end；缺少start是已有内部完整性错误，采用同中止分支的明确错误，不估算时间。

以当前package正式test runner（测试运行器）选择streaming-text-prefix，之后选择producer-boundary、llm-activity-retry及task-root-multistep-assistant作直接相关回归，必要类型检查。测试是生产网络/持久化/事件后端checker（检查器），没有DOM（Document Object Model，文档对象模型）或UI自动化，不能称OpenAI远端端到端或新的网页视觉验收。没有生产UI改动，本轮不以250旧截图替代新界面交付。

说明当前Provider架构正文生命周期时间契约，同步根/月/相关README及当前docs:check、architecture-index，保存原before/after真实出口和限制。只提交本轮明确文件，fetch/merge upstream（取回/合并上游）、审查完整outgoing（待推送提交集），必要验证后正常push（推送），不建分支/工作树/tag/Release。应用内新增子执行范围仍待回复，不依赖它开始此次独立后端验证。

## 修改前真实检查与工具链核对

正式test runner第一轮实际0pass/5fail、exit1：四个自然完成场景明确start覆盖；中止数值比较另遇到matcher（断言匹配器）污染；并发另一成员在同伴断言失败后进入全局fixture（夹具）dispose（清理）而结束为UnknownError。没有把后两项归为已证明产品异常。现夹具的finished barrier（完成屏障）位于成功断言后，finally无条件resolve使断言失败时提前清理全局Instance；这是可定位的测试所有权错误，已改为finally实际join两处理器后才允许任何memoryProject清理，正常与失败共用该屏障。

另最小实际Bun 1.3.14 probe（探测）证实expect(value).toMatchObject({time:{end:expect.any(Number)}})把value.time.end从数值19改成object；因此后续读取匹配过的DTO（Data Transfer Object，数据传输对象）会读到matcher。这不改SQLite事实，也不是中止时钟故障。时间测试现在先复制数字、检查真实持久值/事件，再执行原内容匹配；没有升级依赖、替换生产数据或压制断言。

工具链修复后重跑同一正式验收：实际1pass/4fail、26断言、14.72s、exit1；外部中止开始/结束与事件契约通过，长/短/重试成功/并发自然完成均在明确开始数值处失败。两并发处理器现在真实join后清理，原全局dispose异常不再影响同伴；原两轮日志和probe保留。根因分析完成，现实施只改自然text-end的time赋值。

## 最终实施与验证

生产text-end保留既有time并追加end，内部缺start采用既有中止路径的明确完整性错误。当前Provider架构说明这一单一事实契约。原四文件正式checker全部实际0，5+10+6+3共24项、108断言；原foreground87586实际join0。最后夹具加入try/finally保证处理器自身异常也完成两方屏障，原五项重新14.94s/43断言/exit0，原7118实际join0。后端node/tsc原6450实际0，docs与architecture当前0；补新增记录/索引后按现声明重新检查。没有新Provider鉴权、外部模型或UI验收，无生产UI改动。详情[结果](text-part-time-251/README.md)。
