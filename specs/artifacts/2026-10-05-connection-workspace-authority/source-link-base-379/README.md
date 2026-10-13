# 379 网页转换链接目标证据

依据 [方案与 Recall](../source-link-base-plan-379.md) 单 agent 实施。四张实际截图已逐张人工查看。

| 真实页面 | 观察结果 |
| --- | --- |
| [修复前引用](before/01-relative-web-link.png) | 实际模型按请求摘录工具中的相对网页链接；原网页Source正确，但正文引用丢失网站地址。 |
| [修复前点击](before/02-wrong-local-file.png) | 引用误开项目内Etiquette.html，文件读取404并显示实际错误。 |
| [修复后引用](after/01-resolved-web-link.png) | 同请求得到完整官网链接，来源仍为实际读取的父页面。 |
| [修复后点击](after/02-opened-web-article.png) | 从引用实际打开209页，地址为https://www.w3.org/Provider/Style/Etiquette.html，呈现Web Etiquette文章。 |

后台检查器读取规范数据库里的真实Source/ToolRequest/ToolOutcome/自然终答，用现有Markdown词法解析器核对四个发布者链接的实际目标；人工点击结果与截图独立复核。没有DOM、组件、快照或UI文本自动断言。原始HTML转换结果、读取网页事实及两个完整运行链均保留，匿名响应cookie已从采集元数据过滤，原授权凭据经既有redactor处理。

新增11个链接HTTP合同改前1pass/10fail，改后全通过；补充内嵌图片附件、XHTML和原生Markdown保真，共14pass/45断言。加上同轮已通过的标题、编码、输出和Source fragment合同，最终覆盖34个测试、160断言（33143与98750均exit0）；类型96041 exit0。文档345ops/25groups、架构18文档索引通过。没有新增依赖或前端构建；实际页面仍为377正式私有产物main-BuketuB2.js，运行后端为当前代码。

before原52834实际exit0、Native131707ms，after原41710实际exit0、Native171362ms；各5次gpt-6.1-sol流式HTTP200/EOF，均在原600000ms/12请求边界内。每个scope只有1次真实webfetch及自然终答，没有调用成员。Host/Native/output/request/端口与auth/models配对完整清理。自己的207、208、209页面关闭，IAB最终为空。前态的真实404保留为问题证据，不因Native正常退出而宣称前态页面通过。

本轮只解决HTML/XHTML转Markdown时的目标解析。原生Markdown响应仍保留发布者原文，相对引用消费未扩展；框架内页面不自动抓取。原359首次复制的精确浏览器/工具问题仍未知，本轮没有改写剪贴板或宣称已修复。Windows开发服务及W3C页面为本轮实际视觉范围；Tauri窗口、其它平台和完整安装包未验证或发布。

本目录保留真实抓取W3C页面的运行证据。材料源自 Tim Berners-Lee 的 [Hypertext Style: Cool URIs don't change.](https://www.w3.org/Provider/Style/URI.html)，原文版权标记 (c)1998 Tim BL；保留源站内容与实际工具转换结果用于软件行为复核，不把它们发布为新技术规范。适用 [W3C Document License](https://www.w3.org/copyright/document-license-2023/)。Copyright © 2023 W3C®. This software documentation includes material copied from or derived from Hypertext Style: Cool URIs don't change., https://www.w3.org/Provider/Style/URI.html.

导航截图包含 Tim Berners-Lee 的 [Etiquette for information providers](https://www.w3.org/Provider/Style/Etiquette.html)，原文 ©1992–95 Tim BL，同样按上述W3C文档许可保留作者与来源。Copyright © 2023 W3C®. This software documentation includes material copied from or derived from Etiquette for information providers, https://www.w3.org/Provider/Style/Etiquette.html.
