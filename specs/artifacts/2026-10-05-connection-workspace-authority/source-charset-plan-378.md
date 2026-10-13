# 378 网页来源与正文字符编码

## Recall

用户持续要求 Sources/渲染/UI（User Interface，用户界面）和功能深入迭代，最新仅单 agent。377 已推送 6da18e2570a41ba2f2c0c9173dcf085506c52f01；本轮开始工作区干净，上一轮属于 progress。先排查网页地址打开链路：SourceUrlPayload 已限定 HTTP(S)，持久化统一验证，排除先前怀疑的任意协议直接导航；未据此添加冗余限制。

实际读取国家统计局 2011、2024 年鉴首页，均 HTTP 200、Content-Type=text/html，原始字节内声明 charset=gb2312。现有 UTF-8 解码分别得到乱码标题，按发布者声明解码得到“中国统计年鉴-2011”“中国统计年鉴2024”。完整 888/887 字节及响应元数据保存在本轮证据，不凭截图标题猜根因。网址：https://www.stats.gov.cn/sj/ndsj/2011/indexch.htm 、https://www.stats.gov.cn/sj/ndsj/2024/indexch.htm 。

已读 webfetch.ts、来源构造/持久化/SourceUrlPayload、现有标题/正文/fragment 合同、SourceParts、07-panel、旧326显示方案。全仓检索 TextDecoder、charset、Content-Type、现有编码依赖，未发现 webfetch 可复用的编码识别实现；文件/协议 UTF-8 解码具有不同合同，不修改。原生浏览器抓取由浏览器解码，也不替换。未发现调度/队列/恢复/终态异常，本问题是 HTTP 字节到文本的确定性解码错误。

## 根因与影响

executeWebFetch 在读完受限响应后执行无参数 TextDecoder，丢弃响应 charset 与 HTML 声明。来源标题提取和 text/markdown/html 三种结果随后读取同一错误字符串，均受影响。旧测试只提供 UTF-8 字节；325修复的是 UTF-8 输出截断，326是 URL 的可见文字，均未覆盖外部字节声明。图片分支返回原字节，不受影响；5MiB 响应上限、流式 LLM、取消/响应所有者及原 Source URL 身份保持现有合同。无需改数据库、SDK 或消息结构；仅今后抓取正确解码，不伪造重写历史消息。

## 实施方案

使用成熟编码 sniffing（识别）库 html-encoding-sniffer，沿其 HTML/XML 标准算法解析 BOM（Byte Order Mark，字节顺序标记）、HTTP charset 与文档声明；不手写 meta 正则或按站点硬编码。HTTP MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）使用现有运行时标准 MIMEType 解析，避免 quoted charset 和大小写问题。纯文本、Markdown、JSON 等不按 HTML meta 解释；使用 BOM/HTTP 声明/UTF-8 默认规则。未声明编码保持产品现有 UTF-8 默认，不增加猜编码的重试路径。标题、正文和截断都消费同一解码字符串。

库的标准编码名/标签和完整解码沿 @exodus/bytes 的维护实现，声明直接依赖而非偷用传递依赖；HTML 识别库7.0.0、对应类型版本与实际安装内容核对后落盘。官方依据：[html-encoding-sniffer](https://github.com/jsdom/html-encoding-sniffer)、[WHATWG Encoding](https://encoding.spec.whatwg.org/)、[MIME 标准](https://mimesniff.spec.whatwg.org/#parse-a-mime-type)。依赖增加和实际构建影响应在验证记录说明。

## 验收

在真实 HTTP 检查器调用 executeWebFetch，验证 GB2312/GBK meta、HTTP charset、BOM 优先级、XML 声明、非 HTML 字面内容、UTF-8 默认及三个输出格式的明确结果，并检验持久来源标题。已有相关 HTTP 正向合同按当前定义执行；禁止 UI 自动化、源码文案/DOM/截图断言。真实网页验收使用既有正式377前端私有副本，后端开发服务 /ui，单人真实 gpt-6.1-sol webfetch 官网原文，人工截图对照来源标题及工具内容。

预声明 source-charset-378-before /18386 和 source-charset-378-after /18387 两个独立 NativeService，各原固定600000ms/12累计Provider请求，不延长运行轮次。before在生产修改前完成并物理清理；after在聚焦合同通过后启动。auth与完整models成对私有复制，验证 usable/projected/actual gpt-6.1-sol streaming；秘密不入日志/提交。自己的页面关闭、原launcher join、Host/Native/output/request/端口/配对清理全部记录。正常 Source 点击实际官网导航可验证，历史坏标题不自动重写。

同步根/月/产物索引和当前架构；按仓库文档检查、类型及必要打包验证，范围提交、fresh fetch/merge、完整待推集合审查后普通push。仅本轮真实输入与平台可宣称通过，其他网页/编码/平台不能外推。goal继续active，单 agent。

## 实施与真实验收

实际安装html-encoding-sniffer7.0.0、@exodus/bytes1.16.0、类型3.0.2；核对安装源码确认XML选项与标准解码接口。MIMEType只解析一次响应媒体与charset，HTML/XML使用sniffer；其他媒体仅从声明识别编码，标准decode hook处理BOM并解码。UTF-8默认保留；标题/正文共用结果，图片原字节分支保持现有完整内容合同。生产仅25行增删，无站点条件、平行语言目录、工具旁路或历史消息回写。

新增16个实际HTTP编码合同改前6pass/10fail；修改后与既有相关合同共34pass/185断言，原81317 exit0，类型30695 exit0。实际编码依赖bundle27modules约0.39MB，执行产物对已捕获官网完整字节输出正确GBK全文；未冒充完整安装包构建。

before/after各真实gpt-6.1-sol调用两个相同官网地址，持久化来源标题由乱码变成正确中文，HTML正文也正确；来源点击打开真正的2024官网。五张截图人工复核，完整ToolOutcome与独立解码的原始HTTP字节按现有输出空白合同逐字相等。原17052、42977及shutdown均实际exit0，Native92251/194736ms，每scope6次流式200/EOF，小于固定600000ms/12请求；Host/Native/output/request/端口/auth-models与204/205/206页面全部闭合。

具体证据、完整源站输入与范围限制见 [验收目录](source-charset-378/README.md)。正常推送后继续持续goal；未发布、不创建tag/PR。
