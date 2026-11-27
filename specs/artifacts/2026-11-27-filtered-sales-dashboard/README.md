# 筛选销售看板真实任务与修复证据

[完整根因、影响、方案与结果](../../records/2026-11/2026-11-27-filtered-sales-dashboard.md)。实际Work（工作）ses_hV1OnPAfOAfCSKWMunWr由精确GPT-6.1 Sol读取[sales.csv](sales.csv)并一次成功发布[原始看板](published-dashboard.json)，没有手工注入产物或修改消息。当前看板数据、发布时指标与原始规格均保持不变。

| 本人实际查看的截图 | 观察 |
|---|---|
| [before-full-dashboard.png](before-full-dashboard.png) | 全量订单图保留正额、负退款与零金额点，区域净额28.25/7.35 |
| [before-workspace-all.png](before-workspace-all.png) | 全量指标与两个筛选正常，明确height:65的汇总仍被局部最小高度撑开 |
| [before-east-refund.png](before-east-refund.png) | 华东＋退款为1笔/-2.05，真实A003负条 |
| [before-empty-intersection.png](before-empty-intersection.png) | 华南＋退款为合法空交集，三个视图仅空白、没有解释或恢复动作 |
| [after-workspace-all.png](after-workspace-all.png) | 新5/5计数与清除入口，汇总尊重65高度、普通图形完整 |
| [after-empty-zh.png](after-empty-zh.png) | 同一合法空交集为0/5，明确无匹配反馈取代空图，筛选和全量指标保留 |
| [after-reset-zh.png](after-reset-zh.png) | 键盘Enter清除后恢复全部与正/负/零五条数据，焦点仍在清除按钮 |
| [after-empty-en.png](after-empty-en.png) | 关闭/再开作品并切英语，华南＋是状态保持，英文数量/提示/动作正确 |
| [export-navigation-en.png](export-navigation-en.png) | 英语清除后全部图形及区域28.25/7.35可见，原生图形导出位置实际复核 |
| [after-inline-east-refund.png](after-inline-east-refund.png) | 中文内联卡片1/5、-2.05正确，筛选/计数/清除无溢出 |
| [after-inline-reset-zh.png](after-inline-reset-zh.png) | 内联再次清除恢复全部、5/35.60、五条图形和零值点，焦点可见 |

页面通过隔离开发服务/ui/实际原生操作取得，无UI（User Interface，用户界面）自动化测试或像素/源码文案断言。产品文案/数字/日期随中英语言，模型原字段、标签、视图及技术内容保留其真实语言。

- [实际任务输入](task-run43.json)、[真实参与者可见正文](actual-task-text.json)、[正式发布工具结果](api-publication-run44.json)。只归档text（正文）部分，原始数据库五表副本含加密推理，仅私有仓外保存，不提交或打印。
- [实际来源与持久事实检查器](check-facts.py)、[基线检查](facts-run43.json)、[候选检查](facts-run44.json)：源5行和发布数据逐字段核对，金额及金额分整数一致，全量指标和华东/华南/退款各交集由Decimal（精确十进制）独立计算。原21文件/1895旧行/示例HEAD逐项保留，数据库完整性ok，候选正式工具接口仍为同一完成产物。这里的纯数据检查不能替代上述视觉验收。
- [当前区域图实际SVG（Scalable Vector Graphics，可缩放矢量图形）下载](regional-all.svg)、[下载检查器](check-download.py)、[真实下载事实](download-facts.json)：两次原生Save as SVG（保存为SVG）在浏览器生成visualization (1)/(2).svg，各21007字节，全文相同，XML（Extensible Markup Language，可扩展标记语言）可解析、949×160、文字含华东/华南/28.25/7.35。原来visualization.svg为8月文件，未覆盖。Computer Use的waitForEvent两次均超时，但实际浏览器文件已完成；未把等待失败当作产品故障或绕过下载验收，已改由具体真实下载的时间、文件、结构和数据核实。没有调用网页Blob（字节对象）旁路伪造下载。
- [类型](typecheck.log)、[双语3349键](i18n.log)、[CSS（层叠样式表）9425引用](css.log)、[正常构建56.76秒/renderer（界面运行面）公共面](build.log)为辅助。归档日志仅清理行尾空白与换行，仓外原日志保留。本批改动仅界面组件/样式/文案，无非UI数据或协议改动，不新增后台或界面自动化测试。
- [模型与退出审计](model-audit.json)：run43/51643共6次实际请求，含预检及新真实看板任务；候选run44/64166仅2次既有预检，用同一产物复验。8次全部精确gpt-6.1-sol、流式、HTTP（超文本传输协议）200、settled/eof（响应结算读到结束）。凭据可用、模型目录投影和实际请求分别预检。原句柄89529/14899均正常join（等待）退出0、响应先结算、配对副本退役、端口关闭。

范围边界：未改Vega、输入schema（结构）、金额计算、模型提示、工具可见性、静态指标语义或后端。模型给出的65高度被当前界面尊重，普通视图保留已有默认测量；不将桌面验收扩为移动端或所有复杂Vega规格验收。没有调度/队列/恢复异常或版本发布声明。
