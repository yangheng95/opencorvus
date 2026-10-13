# 378 网页来源编码证据

依据 [方案与 Recall](../source-charset-plan-378.md) 单 agent 实施。五张截图已实际呈现并逐张人工复核。

| 页面证据 | 结果 |
| --- | --- |
| [修复前 Sources](before/01-garbled-sources.png) | 官网真实抓取产生乱码标题，正文表格也显示原始乱码。 |
| [修复前工具正文](before/02-garbled-tool-output.png) | HTML 声明 gb2312，但实际 ToolOutcome 的 title/p 中文已损坏。 |
| [修复后 Sources](after/01-readable-sources.png) | 同两个实际网址与同一请求，标题显示“中国统计年鉴-2011”“中国统计年鉴2024”。 |
| [修复后工具正文](after/02-decoded-tool-output.png) | 原始 HTML 标题和框架提示文字正确解码。 |
| [实际来源导航](after/03-opened-original-site.png) | 从2024来源点击产生独立206页，地址和官网内容正确。 |

源站原始响应 [2011](public-inputs/stats-2011.bin.gz)、[2024](public-inputs/stats-2024.bin.gz) 及响应元数据均完整保存，分别888/887字节。HTTP Content-Type未带charset，文档meta声明gb2312。运行检查器使用独立标准解码器和既有输出空白规范，与规范持久化的完整ToolOutcome逐字比较，并核对两条Source标题、原URL、真实webfetch输入和completed输出。没有凭模型自述或静态UI文案断言结论。

新增16个HTTP编码合同改前6pass/10fail，改后16pass；合并既有标题、输出、响应关闭、fragment和URL契约后六文件34pass/185断言，81317 exit0。覆盖meta pragma/charset、quoted HTTP charset、BOM优先、HTML/XML区别、UTF-8默认、普通文本/Markdown/JSON字面内容、单字节编码和三种输出格式。类型30695 exit0，文档345ops/25groups、架构18文档及10package依赖拓扑通过。测试均为后台实际HTTP/数据合同，没有UI自动化测试。

before原17052 exit0，Native92251ms、6次Sol流式HTTP200/EOF；after原42977 exit0，Native194736ms、6次同样成功。两个独立scope均在预声明600000ms/12累计请求内，每个均有2次真实webfetch及最终自然回复。Host/Native/输出/请求/端口与临时auth/models配对均闭合，自己的204/205/206页面关闭，IAB最终为空。

本轮只修改后端webfetch和依赖，沿377已实际构建的私有main-BuketuB2.js页面验证，未重建用户共享dist。直接依赖html-encoding-sniffer7.0.0、@exodus/bytes1.16.0和类型3.0.2，lock仅新增这三项。Bun额外实际打包27个编码库模块、约0.39MB，执行产物对完整官网字节得到GBK及正确全文，与独立解码器相同；此项只是依赖打包运行证明，不冒充整个产品安装包构建。

限制：浏览器实际验收为Windows上的开发服务与两个GB2312官网首页；其他编码由聚焦后台合同覆盖，未逐一外部网页截图。未构建或发布完整原生安装包、未验其他操作系统。两页本身为框架入口，工具仍只读取请求的入口文档；本轮没有声称自动读取框架中的年鉴正文。历史坏标题保留，不伪造回写消息。
