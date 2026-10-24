# 网页抓取来源摘录

586单agent；见[方案与根因](../../records/2026-10/2026-10-24-webfetch-source-excerpt.md)及[结构化证据](evidence.json)。

成功的真实 `webfetch` 现在给网页来源提供最多4 KiB的可读摘录，沿用当前Sources控件、身份与持久化。HTML摘录跳过语义导航并压缩多余空行，完整Tool结果继续保留原内容。旧来源不回填，本批没有数据库结构改动。

三次真实页面修订均使用完整577原数据的独立副本、当前开发后端和当前6df前端构建，通过内置浏览器手动体验。每次只让原Main调用一次已知W3C Tabs网页/text；实际合计9次精确gpt-6.1-sol流式200，原reader全部EOF，另有一次启动失败为0请求。截图驱动两次改善，不把初次显示入口当最终通过。

| 截图 | 实际含义 |
| --- | --- |
| 01–02 | 首次输入与结果；02文件名含live，但截到的已是完成态，不作为流式闪烁证据 |
| 03 | 首次展开仍被站点导航占据，促成语义区域过滤 |
| 04–05 | 初次下滚后正文与432px折叠恢复 |
| 06–09 | 第二修订的输入、结果、首屏空行问题与360px正文阅读 |
| [10](10-final-open.png)–11 | 最终紧凑摘录首屏，已有文章标题及正文；11是0px重开，不能据它宣称非零位置恢复 |
| 12–13 | 缩放后菜单尚未关闭的中间态，不作为正文阅读通过截图 |
| [14](14-final-160-body.png) | 160%关闭菜单后，实际内层滚到396px读取正文 |
| [15](15-final-100-reading.png) | 100%返回，复制提示Copied与原网址，继续读取正文 |
| [16](16-final-return.png) | 切到既有其他会话后返回，摘录仍展开且为396px |

最终来源4095字节；HTTP解析、SQLite Source片段及原Message/Tool归属完全一致，正文段落与已完成Tool的规范持久结果一致。列表接口会延迟加载Tool完整输出，验证使用现有completedToolOutcomeOutput读取已持久化结果，没有把空preview误作原始正文。

同时修复真实启动失败时的重复清理：底层bind和上层恢复wrapper曾争用同一process settlement gate。现在绑定错误携带唯一cleanup Promise，恢复wrapper等待它，并保留原socket cause。真实占用端口、取消/释放及重新绑定health200的正向后端验证通过。原54078失败没有保存原生socket cause与历史端口owner，原因仍未知，不将后续成功启动宣称为历史占用证明。

所有隔离实例原exec已join、native/launcher及physical/output/request/精确出生链已闭合，4组auth/models副本清退，3个成功scope均public shutdown200且提前681829/845296/835680ms。源6/90表207330行原字段时间、canonical、文件大小/mtime保持；隔离目标正常迁移到当前8，失败scope原字段差异0，成功scope各5行正常memory/容量/Session变更单列。用户18571服务未操作。

19个webfetch正向后端测试、30个启动/运行时后端合同、backend typecheck、docs/index通过。没有新增或运行UI自动化测试。原非虚拟成员Rendering高频闪烁本批未复现，不能据此宣布它的根因已修复。
