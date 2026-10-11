# 280 来源章节定位

## Recall

用户持续要求自主单agent深度体验、修UI（User Interface，用户界面）/功能，重点Sources和子侧栏Rendering；不委托/新Task/成员、不操作用户页面23/18107。279实际普通Side实时固定阅读返回通过，原Research Studio旧schema/原全帧视觉未验；03c570d8f01cbc3ddea9335c5474181bc3ca0530已正常push，当前工作区干净。最新单agent覆盖旧goal多agent措辞，goal active继续。

已读AGENTS、279 Recall、tool/source、webfetch、codesearch、websearch-service、SourcePayload schema、source-persistence、Sources真实anchor/preview/tooltip与消息链、当前07-panel、现有后端来源/HTTP/SQLite测试、138身份投影决策。全仓canonicalSourceUrl/urlSource定义与消费者只有source owner及三个生产工具；SourceURL schema允许fragment，frontend/browser preview已有完整URL语义。现有codesearch来源测试明确把#keyboard和#pointer当同一Source，正向契约与章节目标冲突，需按当前目标修改而非保留旧行为。纯HTTP/数据/SQLite测试非UI自动测试，本轮不引入DOM/HTML renderer/截图断言。

权威依据：[WHATWG URL标准fragment与序列化](https://url.spec.whatwg.org/#concept-url-fragment)、[MDN URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)：fragment是客户端的文档/位置定位部分；HTTP（Hypertext Transfer Protocol，超文本传输协议）网络请求不传fragment，并不要求浏览器导航/证据地址删除它。成熟URL parser/serializer为唯一URL语法owner，不使用关键词猜章节。原截图有arxiv/#A7线索，本轮不调用旧schema原任务或猜原SourcePart实际地址。

## 完整根因与影响

候选可观察问题：webfetch请求一个带#examples的文档，返回Source链接导航到文档顶部；同一消息#examples/#technical_summary两个独立位置被去重。直接触发canonicalSourceUrl强制url.hash=""，urlSource同时把这个无fragmentURL用作sourceId身份和url目标。数据根因不是frontend丢属性：SourceParts href/data-browser-preview-url和Tooltip消费原url，persistMessageSources按type+sourceId保持第一真实事实，因此缺失和合并均发生在工具事实生成。旧URL规范化误把网络资源身份当来源定位身份；之前title、snippet、URL schema和transport完整性修复都沿用了此生成器，没有覆盖fragment导航。

当前接口/路由/SourcePayload fields不变：canonicalSourceUrl仅用new URL(raw).toString()规范序列化，保留路径/查询/fragment大小写及编码；urlSource基于该完整可导航URL定义一个sourceId，既有消息去重和renderer继续唯一实现。不同章节是不同证据位置（对应source-file范围本已区分），同章节的规范等价URL重复仍去重。webfetch当前选择实际response.url（或原请求若Response无url）作为事实，沿其真实redirect URL决定位置；不额外拼接猜测锚点，HTTP owner/流body/超时/abort/重试不变。codesearch/websearch同样保留真实provider URL章节，所有三生产入口影响均覆盖。

公共风险：当前一个消息内不同fragment来源会分别显示，来源数量可能增加；同名标题/域名下的精确位置在既有完整URL Tooltip可读。旧历史SourceID/URL不回写，没有迁移/兼容层/双读写或新的事实字段；旧已丢失fragment无法从标题恢复，不宣称已修历史。来源语义SHA256（Secure Hash Algorithm 256-bit，256位安全散列算法）用于真实不可变位置identity，不将hash相等当功能或源码验收门槛。调度/队列/恢复/并发/终态没有变动或异常证据；若实际发现则立即按共享机制全入口/轮次/项目横审。

## 实施与接受标准

先独立before正常dev/ui18223：用户已授权OpenAI auth+完整models配对，preflight凭据usable/目标model projected/实际gpt-6.1-sol且streaming=true；单普通Main自然请求一次webfetch https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details#examples 并一句话总结，不新任务/成员。查看实际Source链接、点击产生的真实browser URL/页面位置，保留before。无新增外部凭据。Source与目标web页面均用CUA（Computer Use Automation，计算机界面操作）真实点击/截图人工复核，不做UI自动化。

before自己的页面正常关闭/唯一shutdown、原前台actual join、完整独立PID出生/物理输出请求/端口/pair退休/脱敏归档、所有checker/observer实际结束后五自产物精确保管，然后实施唯一source owner修复。聚焦正向后端测试：规范URL保留精确fragment、code/websearch projection URL、实际HTTP webfetch的两章节/redirect最终章节返回、真实SQLite同两位置和重复同位置语义。更新过期codesearch测试，不新增负向核心断言；实际输出/状态/fields用直接比较，不靠hash或fixture-only冒充端到端。

after独立dev/ui18224：同真实provider一次请求两个MDN章节、实际Sources两个位置/Tooltip完整URL，分别点击核对browser地址与章节视口。既有UI没有修改，无需无变化build；typecheck、相关backend测试和当前docs/architecture检查。before/after各NativeService600000ms/12累计请求，目标提前至少4分钟闭合，不因观察超时重启/扩期/加预算；真实结果不满足则明确保留。

全部当前原handle join后才归档自己的五Native文件。根/相关/月README与当前07-panel更新，完整公开证据credential扫描/diff/范围commit；fetch/merge upstream、全部待推送集合审查后普通push，不branch/worktree/tag/Release/PR。最终如实限定本次当前Source定位资格，goal active继续其他UI/功能与原子侧栏问题。
