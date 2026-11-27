# 工具失败可读性实页证据

[根因、影响与实施方案](../../records/2026-11/2026-11-27-tool-failure-readable-summary.md)。本批仅调整真实已发生失败的界面投影；原始诊断、消息、工具输入/结果和历史分类保持事实，没有为截图重新制造错误。

| 本人实际查看的截图 | 观察 |
|---|---|
| [before-collapsed-error.png](before-collapsed-error.png) | 3768字符SDK（Software Development Kit，软件开发工具包）错误进入工具摘要，技术前缀占据整行 |
| [before-expanded-error.png](before-expanded-error.png) | 大段完整JSON（JavaScript Object Notation，数据交换格式）作为正文占满阅读区，后续成功表格被挤走 |
| [after-collapsed-zh.png](after-collapsed-zh.png) | 中文短摘要、失败计数及后续成功表格 |
| [after-expanded-zh.png](after-expanded-zh.png) | 简短正文与明确详细信息入口，表格仍可见 |
| [after-diagnostic-start-zh.png](after-diagnostic-start-zh.png) | 原始诊断从种类/名称/来源开始完整呈现，有界区域没有挤走成功表格 |
| [after-diagnostic-end-zh.png](after-diagnostic-end-zh.png) | 原生点击区域聚焦、键盘End到末尾；具体value/formula错误及原callID（调用标识）/toolName（工具名）可读，焦点边框可见 |
| [after-diagnostic-en.png](after-diagnostic-en.png) | 同一开合、滚动位置和真实诊断保留，产品摘要/引导/无障碍名称与日期切到英语 |
| [after-collapsed-en.png](after-collapsed-en.png) | 实际依次收起详情与失败工具，英文短摘要和成功表格正常 |
| [after-historical-mcp-en.png](after-historical-mcp-en.png) | 旧MCP（Model Context Protocol，模型上下文协议）误分类原样保留在详情，产品摘要保持中性并显示真实缺失文件名 |
| [after-current-mcp-en.png](after-current-mcp-en.png) | 新记录tool-execution/McpError原样可见，相同中性摘要及后续成功读取 |
| [after-receipt-source-en.png](after-receipt-source-en.png) | 具名收据来源错误仍提供具体恢复建议、原始诊断及后续成功幻灯片卡片 |
| [after-receipt-source-zh.png](after-receipt-source-zh.png) | 切回中文且保留同一详情；模型原文、文件/收据身份保持原内容 |

全部通过自有开发服务/ui/的真实原生页面操作取得，没有UI（User Interface，用户界面）自动化测试或截图差异断言。长历史使用产品“会话查找”检索实际WorkArtifactReceiptSourceError并选择原消息跳转，未猜测锚点或伪造消息。仓外receipt-history-navigation.png仅为导航中间图，不作最终通过证据。

- [9条实际失败工具接口响应](api-errors-run42.json)、[错误身份清单](error-inventory.json)、[基线事实检查](facts-run41.json)、[候选事实检查](facts-run42.json)、[实际文件/SQLite/接口检查器](check-facts.py)：原21文件/1895旧行逐项保留，候选正式接口的完整失败原因与原持久结果相同，数据库完整性ok，原示例Git HEAD保持。原始五表副本含加密推理，仅私有仓外保存；本目录不包含它。
- [类型](typecheck.log)、[双语3345键](i18n.log)、[CSS 9426引用](css.log)、[正常构建与renderer公共面](build.log)为辅助检查。本次所有产品修改都在界面投影/样式/两语文案，不新增或运行DOM（Document Object Model，文档对象模型）/组件/源码文案/截图自动化测试；没有后端合同改变需要额外测试。
- [模型与退出审计](model-audit.json)：run41/55417、run42/52529，各2次精确gpt-6.1-sol流式200/settled/eof（响应结算且读到结束）的既有Provider预检，分别核对凭据可用/模型目录投影/实际模型。**本批0次新任务请求**，只读重放此前真实任务和失败记录，不把4次预检冒充新生成失败的端到端任务。两原服务句柄21074/35417均正常join（等待）退出0、配对副本退役、端口关闭。

边界：取消、FileNotFoundError（文件不存在）和FileWriteConflictError（写入冲突）分支经源码复核保持既有合同，本批未新触发这些状态，不宣称其真实界面覆盖。没有修改后端分类/SDK/输入校验或重试/调度；原始错误全文通过既有Details完整提供，不按历史分类或英语关键字归因。
