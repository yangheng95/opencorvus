# 来源摘录与工具附件的共同身份

## Recall

587继续用户的自主产品迭代，单agent，仅实际冲突需要用户决定时等待。上一goal turn为progress：a949c2d6f已正常推送main，fresh HEAD/upstream0/0；新增真实webfetch摘录，修复启动失败双重cleanup，49个正向后端合同与真实页面截图复核通过。三个成功scope共9次精确Sol流式200/原reader EOF，另一个启动失败0请求；所有exec/native/launcher及physical/output/request/精确出生链闭合，4组auth/models副本清退、隔离页263–265关闭。原源577 schema6/90表207330原行字段时间/canonical/bytes/mtime保持，目标当前8的自然变更单列。用户18571未操作。原非虚拟成员Rendering高频闪烁尚未复现，不能据Main缓冲或本次Sources功能宣称修复。

当前工作区保留171项他人删除与两缓存目录，没有本批目标文件的其他差异。已重读586 Recall/结果、585成员时序调查、07-panel及reactivity的worker/Source合同，读取webfetch全部解码/摘录/格式转换/内嵌数据外置/截断路径与Source helper，SourceParts身份与纯文本摘录组件、现有excerpt/text-fidelity/link-base后端HTTP测试。全仓搜索externalizeEmbeddedDataUrls和formatFetchedText，均为webfetch文件内私有实现，只有executeWebFetch一个生产调用入口；不存在需要兼容的公共API。原成员链继续核对SubagentConversationPanel→ConversationCard→CardParts→TextPart/model/worker；原Index分组候选仍缺真实插入时序，不直接改前端。

## 修改前深度与根因

可观察风险：HTML可读摘录跳过nav/顶层banner/aside等区域，完整Tool结果仍保留这些区域。当前executeWebFetch对摘录独立externalize一次，formatFetchedText又对正文externalize一次；两个局部Map都从1编号。若正文第一个数据URL在被摘录跳过的区域，摘录里的第一个URL对应正文的第二/第三附件，却写attachment:webfetch-embedded-1。摘录自己的附件数组被丢弃，真实Tool attachments由另一调用产生，产生真实身份错绑。先前只测一个数据URL且正文/摘录顺序相同，因此未覆盖并未根治。

例子：HTML先有一张内嵌GIF、nav含NAV纯文本data URL、main含BODY纯文本data URL并重复引用。raw HTML/Markdown正文按GIF/NAV/BODY分为1/2/3，可读摘录中的BODY必须是3；text正文跳过img，NAV/BODY为1/2，摘录BODY必须是2。不同格式的一次响应拥有各自真实附件顺序，Source必须绑定自己的Tool result，不能用固定跨格式编号。正文/摘录不能互相冒充原字节；Source是已声明的可读短预览。

影响面涵盖所有共用webfetch的普通Session/Task/Mission、并行调用与重试，Map必须每次执行局部独立；成功/输出截断都使用同一附件数组。网络失败、图片直接返回、标题/URL/SourceID、writer/数据库、调度/队列/执行轮次/恢复、HTTP/OpenAPI与SDK不变，本批未触发调度或终态异常，不修改其状态机。已有schema8迁移和已交付1–6文件不改，不清用户数据。消费者仍接收当前output/attachments/source.snippet，没有新协议。新增风险是格式转换可能改变数据URL出现顺序，故必须以实际格式化正文先编号，再处理摘录，而不是以原HTML统一先编号导致text格式新增被省略的图片附件。

## 实施与验收

保持一个externalizeEmbeddedDataUrls实现，改为接收正文、摘录两段有序文本，在同一个response-local Map和附件数组中替换；先处理实际格式化正文，保留其既有编号/附件顺序，摘录复用同一身份。formatFetchedText只接受已经外置的正文及该数组、应用原字节预算，不再次外置。摘录仍按4 KiB完整UTF-8字符前缀/trim，HTML语义过滤与空行政策保持，非HTML原文格式保持；重复URL只对应同一真实附件。没有第二缓存、全局状态、fallback或新配置。

先在现有纯后端excerpt测试添加真实HTTP、三个格式的正向输出/附件数组/MIME/重复URL/Source引用对应断言，用当前源码观察明确失败，再实现并重跑。聚焦excerpt/encoding/source-title/output/text-fidelity/link-base等后端合同，覆盖原完整正文格式、空白、截断和UTF-8。不新增或运行UI自动化测试；没有前端源码改动，继续使用已完成的当前6df Node构建，后端加载当前代码。同步07-panel、记录、产物与三索引，docs/index/typecheck。

实际页面计划使用完整闭合577原源/canonical/PNG的fresh隔离native开发/ui，主端口54081，诊断发布的公开示例文档54082（仅该scope，真实HTTP返回前述三种内嵌资源）。配对当前auth与完整models目录，启动前分别验证OAuth注册、目标模型投影，实际仅精确gpt-6.1-sol流式。预算3次（memory/工作合计），只在原Main请求一次webfetch该已知本地示例/format html、有限说明，不搜索、不重试换地址、不读写项目文件、不创建成员/Task/Goal；示例不是外部出版者资料，也不把受控文档读取得到的结果外推成互联网全站验收。

手工核对实际Source摘录、展开真实Tool输出和附件，BODY引用对应实际BODY附件；打开已有原成员Dock，在Main真实流中观察原文字及Rendering，若无复现如实保留未知。20分钟scope物理上限，至少提前5分钟public shutdown；诊断文档listener随同一scope退出，所有原reader EOF、exec/native/launcher/physical/output/request/精确出生链闭合后清退auth/catalog。源原90表全字段/时间/配置/bytes/mtime保持，目标正常变更单列；若本轮发现共享调度/终态异常，先补横向审计再改。代码复核、范围提交、正常fetch/merge/待推全集检查与原hook/push，保留他人删除。

## 实施结果与真实验证

修改前真实HTTP正向用例明确失败：text正文的BODY位于附件2，摘录却两次写1。生产修复为同一响应的正文/摘录共享Map，正文先编号；三个格式及重复引用合同通过。6个webfetch后端文件50 pass、235 expect，覆盖excerpt/encoding/source-title/output/text-fidelity/link-base；backend typecheck、docs:check350 ops/26 groups、architecture-index20通过。未改前端源码、API、SDK、schema或迁移，未增加/运行UI自动化测试。

真实native54081及受控示例文档54082由同一精确target97828拥有；配对OAuth/catalog、精确模型投影先核对，原Main仅一次GET示例/format html，自然产生251字符输入、47字预告与193字符完成说明/SOURCE587DONE。3次精确Sol流式200、原reader EOF。15消息37Parts中的Source prt_g0VYyJxvE00j7ozCV31O属于msg_g0VYyJwJA00pEK8wiRXt，绑定真实Tool prt_g0VYyJxhG007VzX2RuhE。摘录96字节，两处BODY均指向3；手工展开与复制的323字节原HTML也指向3。真实Tool附件2/3的公开地址分别HTTP200返回NAV/BODY，canonical completedToolExecutionResult、嵌套附件的Session/Message与Source SQLite字段/HTTP解析一致。附件由Tool结果拥有，保存后URL是当前AttachmentStore地址；验证器初次误认仍为data URI及独立part行，按真实规范结果纠正后完成，不据这些错误假设修改产品。

页266截图01为已有成员Dock，02为主会话已完成后的同屏（不能叫流中截图），03摘录，04真实工具附件，05/06为Output与Source共同编号和复制。已人工查看全部截图。Dock三次观察35个renderer owner10–44及文字长度保持，实际data-markdown-rendering均为null；私有data-observed-pending是非响应式旧观察值，不解释为真实Rendering。采样未捕获请求进行中的画面，也不能排除采样间短暂状态，原高频Rendering仍未复现/定案。代码确认成员筛选需要parentSessionID且排除orchestrator，普通根会话的流不是该Dock自身的流，后续不能混称。

本次启动前独立Node socket命令因混用require与顶层await失败，后续shell命令覆盖了退出码，所以不能宣称该预检通过；原模型请求前已分别读取真实ready receipt并核对同一target实际拥有54081/54082。诊断器已改为明确ES module脚本，关闭后在这两个相同端口重跑实际bind/release成功；保留这一时序差异，没有重启正常服务伪造预检。用户18571未操作。

全部reader EOF后public shutdown200，提前807321ms；示例listener在13:10:02Z停止，原exec19145/native97828/launcher均0，physical/output/request与精确出生链闭合，页266关闭，13:10:22Z auth/models清退。源577的90表207330原行字段和时间、canonical、95682560字节/mtime1792828797672.7832保持、integrity ok；仅隔离目标正常schema8，5行memory/容量/Main更新时间变化逐项列在证据。受控示例验证的是响应内附件身份，不冒充外部出版者内容或原成员流式故障的复现。
