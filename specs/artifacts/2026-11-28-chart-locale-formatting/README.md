# 交接图表时间与完整阅读证据

关联[Recall、根因与完整验收记录](../../records/2026-11/2026-11-28-chart-locale-formatting.md)。本批修复共享图表的默认语言格式、作者时间语义指导及行内完整阅读。28张未编辑原生截图均由本人查看；没有UI（User Interface，用户界面）自动化、截图/像素比较或DOM（文档对象模型）断言。布局只读诊断用于根因解释，页面截图负责视觉结论。

| 对象 | 真实证据与结果 |
| --- | --- |
| 原时间语义问题 | [02退款明细](02-before-chart-refund-details.jpg)中UTC（协调世界时）显示毫秒数；正式字段被轴按temporal解析，却被tooltip按nominal呈现。历史作者载荷保留。 |
| 默认语言问题与修复 | [03中文页面的英语默认刻度](03-before-auto-time-english.jpg)；[04中文候选](04-candidate-auto-time-chinese.jpg)、[05英语往返](05-candidate-auto-time-english.jpg)、[27最终中文](27-final-auto-time-chinese.jpg)，上午/下午/十一月随语言更新，作者文字/四点保留。 |
| 独立项目新指南验收 | [初始请求](candidate-task.json)、[初始项目记忆](candidate-before-memory.json)、[真实请求完整文本匹配与数据检查](chart-data-facts.json)；3个主work请求实际携带指南。[15最终退款](15-final-refund-inline.jpg)保留原+14:00与可读11:00 UTC，[11样品](11-candidate-readable-zero-time.jpg)保留0与18:00 UTC。 |
| 行内尺寸根因与修复 | [12初始行内窗口](12-candidate-inline-axis-clipped.jpg)只能内滚动分别看标题/轴；[13原生滚动](13-before-inner-scroll-axis.jpg)排除数据丢失。[14最终行内](14-final-natural-chart-inline.jpg)、[16展开](16-final-expanded-chart.jpg)、[17返回](17-final-return-inline-stable.jpg)完整稳定，图形360/宿主406。 |
| 既有复合交互 | [19完整旧图](19-final-linked-view-expanded.jpg)、[20实际框选](20-final-linked-view-selected.jpg)、[22重新展开保持](22-final-linked-selection-reopened.jpg)、[23原生双击恢复](23-final-linked-view-cleared.jpg)。A001+A002为30.30/2，恢复28.25/3及7.35/2。作者内部宽高及原生横向滚动保留。 |
| 默认画布真实路径 | [新请求](default-task.json)、[24行内](24-final-default-canvas-inline.jpg)、[25展开](25-final-default-canvas-expanded.jpg)、[26返回](26-final-default-canvas-return.jpg)。实际发表图由默认布局产生SVG（可缩放矢量图形）300/宿主346，四记录含负值/零值。 |
| 最终真实下载 | [28原生菜单](28-final-native-svg-download.jpg)、[文件检查](native-export-final-facts.json)、[原始字节ZIP](original-bytes.zip)。最终visualization (10).svg为19708字节、1061×340，逐点记录/金额正确；另保留候选9号导出作中间事实。没有用事件等待、HTTP（超文本传输协议）响应或生成器冒充下载。 |
| 正式来源/保存 | [北仓两图](run146-chart-artifacts.json)、[南仓两图](run146-default-artifacts.json)均与实际工具输入/输出及数据库一致。两份223字节输入、四记录/净18.00、原偏移与独立时间先后逐值匹配；两次候选重启原消息/载荷逐对象相同。 |
| 消息证据 | [北仓](run146-chart-messages.json)、[南仓](run146-default-messages.json)、[投影说明](message-projection-facts.json)。仅归档实际可见字段，省去Provider（模型提供方）推理/协议密文及重复response正文；产品存储与消息未改写。 |
| 数据保护与退役 | [原数据](facts-run146.json)、[原任务/资源](reference-facts-run146.json)、[退役](runtime-cleanup-facts.json)：原23文件/2839旧行、2完成Task（任务）/23行、原59字节CSV（逗号分隔值）及snapshot保持，3原句柄退出0并清理成对副本。20次精确gpt-6.1-sol流均200/结算/EOF（流末尾），详见三份stream-facts。 |

未把库自动ARIA（可访问富互联网应用）英语叙述句型宣称为已翻译，也未改写历史作者错误时间提示；新指南经隔离项目自然任务证明当前行为。Dashboard（看板）共用机制已查全生产入口，本批实际视觉范围为Chart（图表）单图/分层/复合图；不扩大为所有看板或移动端通过。旧392未绑定标签限制保持，当前自有420标签关闭，语言/主题恢复中文/系统。版本0.1.56、数据库schema（结构）13保持，无发布。
