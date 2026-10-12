# 更新日志与页面国际化证据

[Recall与方案](../../records/2026-10/2026-10-13-release-notes-i18n.md)。本任务限定用户新授权的国际化修复，单agent执行，不接续父任务调查。

## 交付范围

根CHANGELOG保持唯一编写来源，61个历史版本/434条历史记录分别保存zh-CN和en-US正文；应用与官网选择当前语言，GitHub发布生成器输出两个语言区。本轮工作另记入双语未发布区，没有版本升级、Release/tag操作或手动部署。历史中文正文、日期和来源链接的保留结果见[实际数据比对](authored-data-fidelity.json)与[翻译条目回执](translation-receipt.json)，不是哈希或UI验收。

应用174份TSX源码调查见[audit.json](audit.json)，已处理找到的产品文案遗漏；品牌、快捷键、技术标识、用户/模型正文、文件与实际诊断内容保留原义。该调查没有UI断言，也不能替代真实页面。

## 真实页面人工复核

| 场景 | 结果与截图 |
| --- | --- |
| 应用英文版本详情、日期与官网入口 | [最终详情](app-en-complete-detail.png) |
| 应用中文正文、标题、日期 | [中文详情](app-zh-final-detail.png) |
| 英文关键词命中0.1.22、1 version | [英文搜索](app-en-final-search.png) |
| 中文关键词命中0.1.22、1个版本 | [中文搜索](app-zh-final-search.png) |
| Provider输入未带http/https的地址 | [中文说明](app-zh-provider-error.png)、[英文说明](app-en-provider-error.png) |
| 有效地址输入状态 | [真实输入](app-zh-provider-valid-input.png)，没有保存或发起模型发现 |
| 用量页日期、周期与文案 | [中文](app-zh-usage.png)、[英文](app-en-usage.png)，数据是实际空周期 |
| 中文首页、定时、专家团及MCP默认状态 | [首页](app-zh-home.png)、[定时](app-zh-scheduled.png)、[专家团](app-zh-squads.png)、[MCP](app-zh-mcp.png) |
| 官网构建产物双语历史列表 | [英文](web-en-all-final.png)、[中文](web-zh-all-final.png) |
| 官网同版本切换中英文 | [英文详情](web-en-built-detail.png)、[中文详情](web-zh-built-detail.png) |
| 官网首页和博客两个语言入口 | [英文首页](web-en-built-home.png)、[中文首页](web-zh-built-home-settled.png)、[英文博客](web-en-built-blog.png)、[中文博客](web-zh-built-blog.png) |
| 文档英文选择后返回根首页 | [原错误](web-docs-return-before.png)、[修复后英文首页](web-docs-return-en-fixed.png)，最终构建也再次确认返回英文首页并进入英文更新日志 |
| 文档代码框标题/复制操作的语言 | [中文](web-zh-code-final.png)、[英文](web-en-code-final.png)；真实页面辅助语义分别为“终端窗口/复制到剪贴板”和“Terminal window/Copy to clipboard” |

所有截图由独立真实浏览器页面呈现并人工查看。没有新增或运行UI自动化测试、DOM断言、像素/截图断言或浏览器fixture。首轮已发现并修复英文1 versions和过期Chinese-only说明；Node官网错误、仍显示英文代码框、首页动画未结束等原截图留存，不能作为通过证据。

## 检查与隔离服务事实

23项聚焦数据/配置测试通过：util更新日志12项/13断言，locale设置/运行时选择8项/19断言，文档路径→语言合同3项/5断言。文档文件URL合同在原库正向复现2fail/1pass，修正后3pass；它是数据合同测试，没有正文、DOM或组件渲染断言。官网真实MDX路径的代码框文案还独立补齐目录，并实际复核。

应用私有生产构建、overlay/util类型检查、双语目录（2种语言/2155键）、官网check（104文件、0error/0warning、21既有hint）、官网完整构建（261 HTML文件及搜索索引）、版本正文checker和docs:check（345 ops/25 groups）通过。原始输出压缩保存在[logs](logs/)，构建不是视觉验收。

应用经production listener/recovery启动到/ui，使用自有空项目、隔离HOME/运行目录和无凭据环境。最后两个原始wrapper exec分别23040和72903实际exit0；[app-final](services/app-final/terminal.json)与[app-complete](services/app-complete/terminal.json)保留生产stop结算结果、启动occurrence与真实DB全部表计数。首次66192实际exit1由私有helper重复结算引起；[原stderr](services/app/stderr.log.gz)保留，原scope不计成功验收，也没有重启它或改生产stop机制。

官网开发脚本已实跑并确认Bun executable；最终production build通过官方preview启动到18462。CLI的启动/停止返回exit0，后台daemon退出码不可取得，不虚构daemon exit0。所有自有进程的[最终物理状态](physical-closure.json)为Terminated。没有操作用户或主任务页面、窗口、进程，没有Provider、模型或工具请求。

先前private web-build放在package外造成错误依赖解析，原exit1保留。最终输出在packages/web自己的私有目录；临时移出的原Solid目录已经精确恢复，manifest版本和安装策略没有修改。Starlight最终补丁只修复文件URL的语言判别，已删除诊断语句和Bun临时tag文件差异。

## 未覆盖与限制

没有真实模型任务数据，待办卡、带调用计数的会话用量、提交差异引用和演进统计详情未逐项视觉验收；所有页面的全部动态/错误状态尚未覆盖。它们的产品文案已接入目录，不能据此宣称所有状态完成端到端验收。复制反馈文案已补齐但没有操作用户剪贴板来触发反馈。

本地官网preview没有完整的公开Registry/访问统计环境，访问统计呈现对应语言的不可用状态；没有点击下载安装或发布。私有构建沿用本地已有下载manifest，其中旧版本号不代表当前线上或本轮发布事实。GitHub已有Release正文和线上官网部署未在本任务中写入或验证，因此没有“已发布/线上日志已同步”的交付结论。
