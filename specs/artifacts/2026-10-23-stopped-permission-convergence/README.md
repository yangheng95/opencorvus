# 停止后待批准许可收敛实测

553，单开发agent，Source CLI /ui、内置浏览器自有页185。继承552最终UI资产，本批只改后台及公开数据声明。[完整非秘密证据](evidence.json)。

| 图 | 实际观察 |
| --- | --- |
| [01](01-recovered-history.png) | 从闭合552-final复制的原停止记录打开后，原工具仍显示真实取消，待批准许可已由启动恢复终结。 |
| [02](02-permission-awaiting-stop.png) | 真实Sol产生新的单次webfetch请求，界面显示待批准卡及Stop side chat。未批准网页访问。 |
| [03](03-stopped-and-retired.png) | 实际点击Stop后，许可卡移除、工具取消、输入恢复；截图人工查看。 |
| [04](04-reopened-stopped-state.png) | 重新加载自有页并打开同一侧聊，保留原输入与取消工具，许可终态保持。 |

旧per_hXbjERkxfRGkMrzw23VL和新per_hODM24GQLWblaGSuS3Ea各为requested→cancelled；对应唯一decision_slot和真实permission.terminated事务outbox。原Message/Tool终态保留，公开pending GET200/[]。取消展示仍为现有红色attention/error，本批未改界面文案或语义。

4次真实gpt-6.1-sol流式请求全部HTTP200、实际API模型一致、原reader EOF（预检memory/chat，业务memory/chat）。服务19145公开shutdown200，原exec56445/native/launcher退出0，原出生身份dead_or_reused、输出及请求闭合，剩余1022149ms。页185关闭，4份复制auth/catalog退休；原App条目、全catalog内容与mtime保持。

源90表166638原行全部字段、时间及源文件字节大小/mtime保持；目标schema3、实际对象与integrity保持。目标原行仅Side session更新时间、真实memory_chunk/memory_file和两项运行容量租约变化；新增真实许可终态、outbox、输入/输出等如实保留。未操作用户数据库。

独立HTTP关闭重启及晚到批准使用真实服务和受控流式Provider，属于接口合同验证；不是第二个Sol进程。Task/Mission/Session入口横向代码审计和聚焦合同不能冒充全部真实模型端到端覆盖。
