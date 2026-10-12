# 338 读取摘要使用实际类型、范围和数量

## Recall

用户持续授权自主修复Sources/UI/UX（User Interface/User Experience，界面与体验）与功能；最新只允许单agent。上一目标轮337属实质进展，d57ac281e2ce142f835d65a9df36b951f7123f68已推送，本轮开始git status干净。沿用benchmark-debug-template流程；UI只允许真实交互、截图和Root人工检查，不新增或运行UI自动测试。

336实际PDF摘要显示@1+2000，337两行真实文件也显示@1+2000 (2 lines)。对应canonical输入确实是offset1/limit2000，结果PDF metadata.lines/totalLines为0/0、文本为2/2。现有UI混排请求上限和实际返回量。ReadTool目录分支将返回条目数放在lines字段，UI统一标成lines；二进制分支的0/0没有类型区分。当前不是仅换文案，必须传递生产入口已知的实际类型与起点。

已读337/336 Recall与07-panel、ReadTool全部分支/参数、text-file两个实现、skill唯一异步text-file调用、Tool.define真实参数解析包装、conversation/transport的有界metadata、所有totalLines/metadata.lines消费点，以及共享displayToolDetail及主/子/卡片/会话摘要调用。唯一非UI ReadTool计数消费者是session/prompt/parts.ts的host文件上下文range完整性判断；它继续读同一metadata.lines，因此保留既有计数字段，避免另建计数源或改动上下文准入。Skill独立使用text-file异步读取与原有metadata，当前摘要不按read规则显示该工具；本轮不替换Skill读取器。旧异步读取到字节上限时总行数只计已遍历部分，是单独待追查项，不用本轮ReadTool结果冒充其修复。

已读read-attachment-source、read-tool-cited-range、read-tool-error-contract、conversation-transport-projection等后端契约测试与transport-protocol定义。这些验证实际工具/数据传输，不是UI/DOM测试；既有transport状态摘要用于真实协议完整性，不是可变源码哈希门槛。当前相关UI测试检索未发现摘要自动断言。Shared Tool metadata仍是通用record，SDK路由schema无变化。

## 根因、影响面与准入

直接触发点displayToolDetail优先使用input.limit作为已完成跨度，且把所有metadata.lines都当文本行数。336只修title，没有改变范围语义。ReadTool生产者没有给出text/directory/binary类型或实际窗口起点；文本page已有offset/lines/totalLines，目录已有offset/sliced/entries，二进制分支也已识别MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）类型，因此应投影真实分支事实而非在UI解析文件扩展名、output标签或猜测零计数含义。

准入在共享transport-protocol定义ReadToolResultFacts，直接验证当前metadata中的readType、offset、lines、totalLines：text/directory为整数窗口，binary保留原0/0计数且不宣称文本范围。ReadTool各分支向原metadata写入同一份事实；计数字段仍是唯一计数源，host context和Skill不建立双读写。只增加readType与适用的offset，并让当前有界transport显式保留它们。生产者按共享schema验证，消费方使用同一schema。结构不新增存储表/API/模型消息或并行结果。

已完成摘要只读合法结果事实：整份文本显示实际行数，部分文本显示实际起止行和总数；目录使用条目及实际条目范围；图片/PDF只显示真实名称，不标请求行数。生成中的窗口明确标为requested/请求；没有当前类型事实的历史/其他工具仅保留标题/路径，完整输入输出仍可展开，不猜类型、不建旧metadata兼容分支。原Source引用身份、citedReadRange位置与标题规则不变。

同时readTextFilePageContent空字符串当前split产生1个空元素，和实际空文件/异步读取的0行不同；准入空内容按0行处理，保持单独换行代表1个空行。ReadTool offset/limit原schema允许小数和非正limit，可能生成不完整/非整数范围；在原参数schema统一为正整数，保留数字字符串coercion，删除执行体重复offset下限校验。错误通过既有Tool.define Zod cause契约返回，不加工作流gate。

影响面为真实read的文本/目录/图片/PDF、有界大结果与主/子/卡片/会话摘要。既有host显式范围准入继续使用同一lines事实；读取字节、权限、存储、工具结果正文（空文件0行更正除外）、来源与错误所有者不变。风险包括字节上限截断、EOF不足请求上限、空文件/空目录/目录窗口、参数错误、旧历史缺少类型、中文/英文计数与延迟结果展开。未见调度/并发/恢复/终态异常，如出现立即按共享机制横向审计。

## 实施与验收

先在已有真实ReadTool后端测试补充原名附件结果facts、2行文件、尾部不足limit、空文件、51行字节上限窗口、目录窗口/空目录和明确参数错误。原实现失败日志保留后再修。transport正向测试验证大metadata时text/directory/binary事实经过真实投影保留。聚焦相关后端测试、前后端类型、overlay build、i18n、docs；不跑UI自动测试。

真实开发NativeService http://localhost:18314/ui，fresh read-facts-338-live-01；已授权auth/models配对预检usable/projected/actual gpt-6.1-sol streaming。累计12请求，Native出生600000ms上限和180000ms无活动观察固定。通过正常Work Chat读取PDF、2行短文件、文本尾部窗口、3条目目录窗口与空文件；模型不委托、不建Task、不写文件。Root截图核对名称/实际范围/单位、完整Input请求保留、来源打开和历史返回；需要两种语言时只改自建隔离页面设置。

归档真实Provider/请求/结果事实、原文件与截图，原启动句柄join实际exit，自有页面、Host/Native/端口/输出/请求和auth/models复制配对收敛。更新根/月/目录README，范围提交，fresh fetch/merge与完整待推送集合检查后普通push。goal继续active，单agent，不发布版本。

## 修改准入

新增真实ReadTool契约先在原实现执行，98159实际exit1，3 pass/3 fail：binary缺少readType、文本缺少readType/offset、offset0仍来自执行体独立错误而非统一参数cause。原失败日志保留；据前述生产分支/计数/参数证据准入实现。空文本与其他窗口会在最终同一真实工具矩阵逐项核验，不把本轮原checker因首断言停止的后续项宣称已运行。

## 实施与最终证据

共享ReadToolResultFacts在原metadata中验证readType/offset/lines/totalLines，ReadTool三分支从实际结果产生，transport有界字段保留同一事实。旧计数没有复制到第二层，也未改host上下文读取metadata.lines的契约。参数统一在原schema准入正整数；空内容0行，单独换行仍1行。UI完成态使用实际结果；请求中范围明确标注为请求。中英文数量/范围同一实现，图片/PDF省略文本行窗口；缺少当前类型的旧记录保留名称及可展开原详情，不推断旧计数含义。

64801聚焦四文件25项测试实际exit0；增加单独换行保持的正向案例后，10840最终read六项/48断言实际exit0，其余相关已通过文件不无目标重复。63144前端类型、31182后端类型、protocol类型、i18n、docs均exit0。76507正常构建exit0，真实/ui提供main-HB6Ez6mO.js。没有UI自动测试。

真实NativeService18314、Native51368/Host13356；授权auth/models成对预检usable/projected/actual gpt-6.1-sol streaming。五次read的实际输入均有limit2000，PDF/短文本/尾部/目录/空文件结果分别为binary0/0、text1+2/2、text29+2/30、directory2+2/3、text1+0/0；9次实际Provider流全部HTTP200/reader EOF。四条文件Source、PDF原件、三个文本原件和目录内容、结果/请求归属都经实际后台checker核对通过，未对UI文案/DOM/截图做断言。

Root逐张人工查看9张实际截图：01英文短文件/尾部/目录/空文件摘要，02完整Input的2000上限与实际29-30输出并列且PDF无行窗口，03PDF加载中间帧，04真实16页PDF已加载，05文本编辑器刚打开尚未完成引用定位的中间帧，06随后实际29-30行高亮，07仅在自建18314页面切换中文后的实际摘要与空文件预览，08中文目录第2-3项与beta/gamma输出，09切到另一真实会话再返回，当前可见目录/空文件摘要保持。03/05不作为加载/定位完成证据，09截图只覆盖当时可见区域；不宣称一次截图包含所有五项。未更改用户页面、窗口、进程或服务。

121页面已关闭；shutdown实际exit0，原启动2659实际join exit0；精确Host/Native、端口、输出、请求和复制auth/models配对收敛。38份文本/解压证据凭据扫描0匹配，原日志私有保留，公开日志无损gzip。[证据索引](read-facts-338/README.md)。历史typed facts在当前结果中持久化，旧记录不批量改写。

待后续调查明确保留：Skill使用异步text-file读取，在字节上限提前break后其totalLines语义与实际文件总行数可能不同，本轮未修复该独立路径。Tool.define的通用coerceArgs会把任意字符串字段的true/false转为boolean，字面文件名入口需下一批真实验证。当前没有此类调度/终态异常证据，不作相关归因。范围提交、fresh fetch/merge与正常push后继续单agent，goal active，不发布版本。
