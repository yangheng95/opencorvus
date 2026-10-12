# 326 来源 URL 的可读文字

## Recall

用户要求持续自主改进 UI（User Interface，用户界面）与功能，主要关注 Sources 与侧栏 Rendering；最新明确只用单 agent，覆盖旧 goal 的多 Astra 描述。上一轮325为progress：完整字符截断修复已正常推送`8da328cd5dce54f667872d16e07d2448ab33adc3`，当前工作区干净，所有旧进程与页面已关闭。

325真实普通Chat的[来源截图](source-utf8-325/screenshots/01-source-and-complete-prefix.png)可见无发布者标题的公开API（Application Programming Interface，应用程序接口）来源显示两行技术查询串，中文“北京市”完全成为百分号编码。已读325 Recall、SourceParts全文、messages.css来源样式、Markdown解码路径、167/168标签历史、270标题记录、07-panel与全仓sourceLabel/SourceParts/URL解码搜索；没有适合复用的URL显示primitive。Markdown函数属于文件引用的语义解析，不可挪作来源显示。唯一SourceParts经CardParts服务主会话、Task/Mission及子侧栏，没有第二套来源显示。

## 根因、契约与风险

现象由`new URL(source.url).pathname/search/hash`保持百分号序列，而sourceLabel/location直接展示这些序列触发。此前路径优先/站点分行解决同域路径辨识，标题提取解决有HTML/XHTML/Markdown元数据的来源，但真实JSON或纯文本资源没有title仍走同一编码显示路径。不能凭查询键猜文章名、抓取另一页补标题或改Source身份。

已查[WHATWG URL rendering](https://url.spec.whatwg.org/#url-rendering)：非主机部分的可见国际文字应可读，需保留会导致不可见或误导的编码；主机与原始完整URL仍可辨认。本轮只作显示投影：非ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）百分号字节序列交给标准decodeURIComponent解码；Unicode控制、分隔及默认不可见码点保留编码，非法UTF-8序列也保持原始可见表示。ASCII编码（包括%25、%2F、%26、%3F、%20）、查询顺序、字母大小写及加号不改，从而不将编码的数据误显示成URL结构。没有手写UTF-8解析、关键词标题推断或依赖新增。

真实发布者标题保持原文；缺标题/标题就是原URL时，完整路径+查询经过同一显示函数，fragment位置也使用它；host、Tooltip完整URL、href、preview地址和持久Source均保留现有值。普通文字方向沿当前界面，未宣称完成全套国际化URL防混淆策略。没有调度/队列/恢复/终态异常证据，不改数据、模型、路由、配置或消息契约。

## 实施与验收

仅修改SourceParts显示函数与调用，不新增缓存、排序、截断状态或CSS布局。本轮属于纯UI改动，禁止新增/运行任何UI自动化、源码文案断言、DOM断言、组件测试或截图基线；所查SourceParts测试搜索只命中CSS token检查脚本，未发现专用UI测试。类型/构建仅作前提。

正常构建后启动独立开发`/ui`18296，Base普通单人Work Chat，配对auth/models与实际gpt-6.1-sol流式预检，NativeService固定10分钟/12请求。真实读取公开北京市及上海市查询URL，查看两个无标题来源中文参数、站点和完整链接；另读取W3C XHTML实际标题检查发布者标题仍可读。主agent查看真实截图，点击一个Source并核对实际打开的原始URL；不制造Source消息或浏览器fixture，不操作用户页面/服务。

同时修正已查到的07-panel重复旧句“only text/html title”，使其引用当前HTML/XHTML/Markdown标题事实，避免与较新的段落矛盾。同步根/月/目录索引，运行docs:check和构建声明的检查。真实页关闭、所有原handle join、Native/Host/端口/复制配对清理后归档。精确提交、fetch/merge upstream、审阅完整待推送集合并正常push；持续goal active，未完成项如实记录。

## 验收输入完善

实施后、实际模型请求前，把第三个发布者标题对照从W3C替换为已读取的MDN中文URL构造函数页面及其真实“参数”章节链接，同时覆盖中文fragment的可读显示与原导航。第二个API使用真实支持的双标题查询（北京市/上海市，以编码%7C分隔），在同一次人工截图中核对中文文字和ASCII编码保留；第一URL仍与325完全一致。没有扩大服务预算或添加模拟页面。

## 完成后的 Recall

[结果与人工截图](source-url-display-326/README.md)证明同一北京市来源从两行编码变成一行可读中文；双标题查询显示北京市%7C上海市，真实MDN标题及#参数可读。实际点击新tab100/101保留完整原URL，MDN准确定位到参数章节。第二个公共API真实响应包含exlimit降至1及continue提示，未把它误作两篇完整文章获取。后台规范核对只涉及输入/Source/Provider数据，没有UI断言。

本轮7次实际gpt-6.1-sol流式200/EOF。类型49596、构建34399、原启动74571均join exit0；页面98/99/100/101已关、Native66668/Host16268正常物理退出、18296和复制配对清理完成。没有追加LLM调用或扩大预算。剩余范围提交、fetch/merge/push，持续goal active；其他Unicode及侧栏场景尚未由本轮截图证明。
