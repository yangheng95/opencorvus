# 带时区交接表排序证据

关联[规格与Recall](../../records/2026-11/2026-11-28-table-date-order.md)。真实Sol读取223字节时区记录并发表table@1后，原生日期升序复现词法错误；候选按实际瞬间排序通过，完整下载保持原表。无UI（User Interface，用户界面）自动化；11张未编辑原生截图由本人查看。

| 证据 | 可复核事实 |
| --- | --- |
| [原版本错误升序](03-before-date-ascending-confirmed.jpg) | R04/R03/R01/R02，11月29日之后再次出现11月28日 |
| [候选升序](06-candidate-date-ascending-confirmed.jpg)、[降序](07-candidate-date-descending.jpg) | R02/R04/R03/R01及其反向，符合独立按偏移计算的真实时间 |
| [金额排序](08-candidate-amount-ascending.jpg) | -2.5/0/8/12.5，保留退款及零额 |
| [退款筛选](09-candidate-refund-filter.jpg)、[原生下载菜单](10-candidate-refund-download-menu.jpg) | 筛选1/4时实际点击完整CSV（逗号分隔值）下载 |
| [零额样品](11-candidate-zero-sample-filter.jpg) | 多词搜索定位R03，显示0 |
| [展开](12-candidate-expanded-date-order.jpg)、[返回行内](13-candidate-return-inline.jpg) | 同一日期升序阅读状态保留 |
| [来源/期望](table-input.json)、[实际任务](table-task.json) | 自然用户请求、原始四行、独立期望；不包含凭据 |
| [正式载荷](run143-artifacts.json)、[来源检查](run143-facts.json) | 真实read/publish完整结束，每列/行/原时间戳与输入一致 |
| [实际下载检查](native-download-facts.json)、[原始字节](original-bytes.zip) | 浏览器落地258字节完整原序CSV，全部偏移保留、净额18.00；ZIP另保留输入、既有59字节CSV与北南仓四原文件 |
| [真实消息](messages.json)、[归档投影说明](message-projection-facts.json) | 可见文本、工具和来源；归档剔除Provider（模型提供方）推理/协议密文，产品消息与存储保持 |
| [原数据保护](facts-run143.json)、[完成任务引用](reference-facts-run143.json) | 23文件、2819旧行、2个完成Task（任务）/23行、原CSV及snapshot逐对象/字节保持 |
| [run142流](stream-facts-run142.json)、[run143流](stream-facts-run143.json)、[退役](runtime-cleanup-facts.json) | 8次精确gpt-6.1-sol均流式200/EOF；两原句柄退出0、成对副本清理和自有标签关闭 |

01/04分别记录修复前/候选的来源原序。02未计人工复核，05捕捉前一绘制帧，均未归档或作为通过依据；06为重新捕捉并查看的候选升序。空/非法日期组仅属纯数据正向测试覆盖，没有宣称相应页面验收。历史旧标签392失去绑定的限制未改写为已关闭。当前版本0.1.56、数据库schema（结构）13；本批没有发布行为。
