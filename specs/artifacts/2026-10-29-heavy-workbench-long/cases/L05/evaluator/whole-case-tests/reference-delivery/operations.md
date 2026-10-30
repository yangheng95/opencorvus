# 替班操作
保原local/remote SQLite、原journal/批准调整/notes/ACK日志；receiver是独立HTTP服务，不能改它的effects库。以submission app_argv追加--db LOCAL --url URL --request REQUEST --input PUBLIC_RAW运行。先status/monitor incident，核未决key，不用新key重发。
pause请求带当前epoch和稳定repair_id，检查返回完整accepted prefix/intent目录；暂停仅阻新登记，不撤旧socket。repair同一repair_id恢复，确认前/计划后中断都原请求重试，不能删cuts重计划。未完成resume应repair_incomplete；全部匹配receipt并逐source对账后才推进epoch。旧generation新请求stale，已接受的原payload重试仍duplicate；变载荷必须transport_conflict。
新事件先保存accepted，业务版本按最高唯一，不按传输次数或到达先后。批准负调整先核opening+所有负调整>=0，原notes不变。双sender可以查询/同键POST竞争，收据必须逐完整payload匹配；服务重启后用原库重新启动，URL更新给新命令，同键收据不能改。
monitor离散window_id保持原样本，pending或source差异尚存不宣称业务恢复；最高版冲突只能新权威更高唯一版解决。无限故障、缺键或原载荷不可信应保留中止并人工对账，禁止回旧备份删新accepted。reconciliation.csv、business.csv和monitor.csv必须与实际数据库/HTTP收据一致。
