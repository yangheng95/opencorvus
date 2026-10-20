# 配置保存：日志与原生启动成本对照

本轮没有生产源码改动。真实对照排除了三个简单优化方向，原保存 10s、恢复 5s、并发读取 20s 门槛保留。

| 日志级别 | 项目数 | 保存 | 恢复 | 最长并发读取 |
| --- | ---: | ---: | ---: | ---: |
| DEBUG | 124 | 15638.152ms | 14851.803ms | 15892.972ms |
| INFO | 125 | 14819.465ms | 14484.729ms | 15086.892ms |

[真实请求与阶段准入](results.json)使用同一正式464前端、同一当前后端、完整历史和相同小型阶段标记。四读在原候选阶段进入后才发出，全部200，目录227 Provider/8133模型。完整原canonical与Ask恢复。DEBUG实际36423条/13.74MB，INFO5471条/1.28MB；日志显著减少仍未解决耗时。reader也已移除反复扫描整份日志的开销，不能据此把INFO当作性能修复。

[原CPU采样按HTTP窗口归因](prior-request-cpu.json)：首写1403个sample中602、恢复1558中691位于native spawn栈，经Node child_process到spawnWindowsRequest。epoch微秒及sample deltas与原进程/请求时间对齐；采样数量不是墙钟毫秒。其余主要线索包括真实which/isexe stat、DB rows和MoveFileExW，不能仅靠最后一个open span认定根因。

[私有helper创建标志实验](flag-probe.json)及[原输出](flag-probe.log)：148个原Process.runHost命令全部结算，24目录交错单并发/12并发对照，以及完整1MiB stdin、2MiB stdout、512KiB stderr。attached单并发较快，12并发却为1347.992/1282.295ms，原detached为992.139/1105.427ms，没有稳定收益。生产detached策略保留；局部Host探针不冒充Task/root、重启或durable后台转移验收。没有移除Job、ready/cancel/settled或输出完整性保护。

[实际页面与人工观察](manual-ui.json)：[DEBUG等待](debug-wait.png)、[DEBUG目录恢复](debug-loaded.png)、[INFO等待](info-wait.png)、[INFO目录恢复](info-loaded.png)，四张1280×720截图均已人工查看。只有CUA真实交互，没有UI自动化。

[原生、Provider与复制对结算](native-settlement.json)：原1237/63659 exit0，两个公开shutdown200；原52235/92546/4641/94887全部exit0。4/原12个实际gpt-6.1-sol流式请求均200/eof。原flag-probe67277 exit0、live0。[只读历史](results.json)保持schema2、125 Project/167 Session以及两份原快照的每个身份/目录/归属；[两套私有复制对退休](private-pair-retirement.json)，源凭据未写入或refresh。

配置保存/恢复仍未达标。本轮明确不改变默认日志、不删除脱敏或诊断、不采用无稳定收益的创建标志。新的Task Goal执行、原生目录picker、Sources与侧agent直播Rendering仍无本轮资格。持续迭代下一步回到实际Goal执行链，同时保留性能问题。
