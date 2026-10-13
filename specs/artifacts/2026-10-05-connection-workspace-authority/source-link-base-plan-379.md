# 379 网页转换后的链接目标

## Recall

持续自主改进 Sources、UI（User Interface，用户界面）和功能，最新仅单 agent。378 已推送47bfcac165dea530a4c3a40cb22948b696747acb，当前开始工作区干净，上一轮是progress。重读359剪贴板Recall：此前已验证实际粘贴与独立MDN同样的首次旧值，生产单writer实现仍与宿主合同一致；本轮没有新增可定位证据，不重复未分离的实验、不宣称修复剪贴板、不加双写或延时补丁。

继续调查来源消费链路，实际HTTP（Hypertext Transfer Protocol，超文本传输协议）读取 https://www.w3.org/Provider/Style/URI.html 得到200。其发布者链接为 Etiquette.html、Structure.html、#remove、../../People/Berners-Lee/；当前Turndown转换仍输出这些相对地址。脱离原网站放入会话后，*.html 被现有文件引用语法解释为项目文件，#remove 指向应用文档。源站链接和原有转换结果均已检查；不是根据模型标题推断。

已读 webfetch完整转换/来源/格式路径、SourceParts、main委托链接处理、Markdown文件引用规则、359/378 Recall、当前07-panel、现有webfetch标题/编码/fragment正向合同、安装的Turndown7.2.0及其Domino参考解析器。全仓检索convertHTMLToMarkdown只有一处生产调用。原生Markdown响应是未经HTML转换的原文，text/html原格式输出也有不同保真合同；不在本轮重写这两个格式的原始链接。

## 根因、影响与实施

HTML转换函数只接收内容，未接收重定向后的响应网址；Turndown保留href/src字面值，格式转换因此丢失原页面解析链接所需的上下文。涉及同级/父级/根路径、查询、章节、协议相对地址和图片，以及发布者base元素。旧标题与编码修复保持原字节到文档字符串，但没有建立链接基址；旧测试链接都是绝对地址。无调度/并发/队列/恢复/终态异常，不改Task/Mission/Session状态或Provider流程。

在唯一HTML到Markdown转换入口传入当前Source使用的最终响应URL（Uniform Resource Locator，统一资源定位符）。复用既有createDocument解析器，按首个base[href]及HTML标准的有效base规则解析文档基址，再使用标准URL解析与序列化展开a[href]/img[src]。data/javascript不能作为HTML文档base；无有效base时标准文档地址仍为实际响应地址。无法解析的原始引用保留为发布者原文本，不猜替代网址。随后把现有文档节点交给Turndown，保留同一套格式化、过滤和data图片附件输出；不复制Markdown生成规则，不自动抓取链接、不生成未读取页面的Source。

已用安装库确认文档节点输入与原字符串输入在真实W3C页面产生逐字相同的未改写Markdown，再按地址解析得到正确官网目标。官方依据：[Turndown节点输入](https://github.com/mixmark-io/turndown#usage)、[HTML文档基址](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#document-base-urls)。不增加依赖。原Source URL/identity、HTML与纯文本结果、原生Markdown返回、编码、截断、图片附件、HTTP取消与上限继续用原事实来源。

## 验收与范围

先在生产修改前经真实模型webfetch W3C页面format=markdown，引用其中Etiquette链接并实际点击，观察是否误开本地文件。然后聚焦真实HTTP调用executeWebFetch的正向合同：重定向最终地址、首个base、父/根/章节/查询、HTML实体、图片和内嵌数据、三个输出格式，预期完整目标明确。禁止UI自动化、源码文案/DOM/截图断言；这些后台合同不冒充实页验收。

预声明source-link-base-379-before /18388、source-link-base-379-after /18389两个独立NativeService，固定各600000ms/12累计Provider请求，不延长或复用轮次。使用377已有正式私有UI及原生产CLI launcher，auth/models成对复制并验证usable/projected/actual gpt-6.1-sol streaming。前态关闭全部自己的页面、join原launcher、完整物理/输出/request/端口/凭据配对清理后才修改生产。后态重复真实页面，人工查看来源、模型引用和实际打开的官网；不伪造消息、Source或浏览器状态。

源站输入仅作诊断，收集必要响应元数据，过滤响应cookie；公开证据沿现有完整日志脱敏归档。更新根/月/目录索引及当前架构，文档/类型/相关功能检查；范围提交、fresh fetch/merge、完整待推集合审查和普通push。未验证的平台、原生Markdown相对链接消费和剪贴板宿主问题如实保留，持续goal保持active。

## 实施与真实验收

生产唯一HTML转换函数现在接收同一Source使用的最终响应URL；首个base[href]按标准解析，a[href]/img[src]在现有解析器文档内成为完整地址，再交原Turndown。调用和函数共24行增删，原HTML/text和原生Markdown输出合同保留。没有新依赖、第二套Markdown规则、UI路由旁路、额外网页抓取或来源合成。

新增11个HTTP合同改前1pass/10fail，修后11pass；补充内嵌图片、XHTML、原生Markdown保真后14pass/45断言，同轮既有相关合同20pass/115断言，总34pass/160断言。33143、98750、类型96041均exit0，文档/架构索引通过。

真实before207页产生相对Etiquette.html回复，点击打开项目文件并404；after208页相同请求产生完整官网目标，点击实际创建209页显示原文章。四张截图逐张人工复核。规范Source仍只有原始抓取父网页，后台检查器核对真实工具输入、四个发布者链接、模型完整回复及Provider/Native收敛，不代替视觉证据。

原52834/41710和各shutdown实际exit0，Native131707/171362ms，各5次gpt-6.1-sol流式HTTP200/EOF，在原固定600000ms/12请求内；完整Host/Native/output/request/端口/auth-models清理，自己的207/208/209页关闭。前态文件404是预期复现的实际问题，未包装成成功体验。详细证据和边界见 [验收目录](source-link-base-379/README.md)。
