# H05 隔离样例发布与恢复操作手册

## 边界与准备
仅运行本题隔离服务。需本机Python 3及标准库sqlite3；不需要第三方包、网络、凭据或外部模型。
保留inputs原样，amount为整数最小单位，身份字符串不转换。禁止将旧totals导入新账或重启旧写入作为回滚。
角色为职责分配建议，不是实际人员签字。业务/事件历史时间未知，不填造历史时间。

## 从零复现与验收
1. 在交付目录运行 `python reproduce.py --inputs inputs --output fresh-run`；fresh-run必须不存在。
2. 退出0且输出self-check-passed表示作者机器检查完成，不代表双人独立验收。失败要保留目录和commands.json定位，不覆盖证据。
3. 核对fresh-run/verification/legacy.json：同进程两次相等，新进程在原旧库上增至两倍。impact.csv逐租户量化差额。
4. 核对ledger.csv每身份一行、totals.csv按租户为{'alpha': 52680, 'beta': 52680, 'gamma': 52680}；replay.csv pass字符串1和2均distinct720、total158040。
5. 比较verification/comparisons所有逐身份记录；检查comparisons.json所有mismatches=0、totals_equal=true。
6. 检查崩溃退出86，恢复前前三边界为空、提交后首笔存在；恢复后完整账本。检查restart.json不同PID、concurrent.json四PID和新入账合计720。
7. 由协调方安排两位独立审查者分别从raw inputs复算、检查报告和runbook、实际执行新路径复跑；作者不得代签。

## 修复服务入口
`python service.py ingest --database isolated.sqlite --events inputs/records.csv`
重启续传、重放、并发均使用同一命令；--start/--stop是零起始传输行切片，不含CSV表头。恢复可全量重投，不能依赖易失游标。
`python service.py snapshot --database isolated.sqlite` 给出同一事务读到的账本与totals。
冲突金额会拒绝且事务回滚；先隔离冲突事件调查，不静默覆盖。不要用另一实现绕过去重。

## 监测与告警
`python service.py monitor --database isolated.sqlite --events inputs/records.csv`
退出0无告警，2有告警；重复率严格大于0.10触发duplicate_rate_high，任一身份差或金额差非0触发ledger_reconciliation_failed。
源期望是该账本覆盖范围的完整raw集合；不能用不完整窗口对完整账本对账。重复率可用单独有界传输窗口，但对账源必须覆盖账本。
本题原始窗口会预期触发重复率告警：103/823；需调查上游重试，不改变业务金额。
监控演练用verification/unique.csv表示后续无重复窗口；对账仍覆盖全部身份。
对账告警：发布负责人停写；财务按租户复算；服务负责人保全故障库并从raw重建新库，逐键比较后恢复。
禁止直接修改totals掩盖问题。verification/monitor.json记录故障注入和恢复，不用于生产破坏。

## 隔离切换与安全回滚
reproduce自动执行真实CLI路由演练，verification/cutover.json保留每步配置。
路由JSON含database相对路由文件所在目录的路径、write_enabled布尔、release标签。通过临时文件原子replace更新路由。
1. 停止旧写入并保留legacy-v1.sqlite旧事实；本演练原服务子进程已退出，不再作为writer。
2. 空库fixed-v2从raw重建；财务逐身份对账，三租户各240身份；故障、并发与重放检查通过后才切换。
3. 将路由指向fixed-v2、write_enabled=true；CLI ingest --route verification/route.json --events inputs/records.csv，核对不增账。
4. 若需回滚，路由仍指向同一修复库，write_enabled=false；写请求退出3，snapshot可读，逐键核对账本不变。旧实现禁止写入。
5. 完成调查并重新对账后恢复true，同一原始数据重投，应无新增；保存命令、PID、时刻、差额与审批记录。
演练最终路由为fixed-v2-resumed。路由使用相对路径，移动完整交付目录后仍指向该目录内同一修复账本。新一轮演练仍必须在不存在的新目录复跑。
本选择器只适用于隔离CLI，无在线常驻进程。真实多节点需额外写入栅栏、停写排空、备份恢复演练与业务审批；本题不声称完成。

## 数据保全与审计
新账依据raw身份重建，不按received_at排序修补数字。保留legacy-v1和fixed-v2版本、impact、historical-rebuild及commands原始记录。
duplicates只来自原始输入attempts，不来自测试重投。所有最终四表在根目录和diagnostics各一份。
commands记录实际时间、命令、工作目录、退出码和输出；比较CSV列出每个身份期望和实值；未知历史时间仍未知。
资源耗时见summary.json；未设置CPU、内存或输出总量提前结束条件。没有外部联网赛道。
