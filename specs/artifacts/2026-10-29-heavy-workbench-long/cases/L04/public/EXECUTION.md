# 执行与故障合同

submission.json示例：`{"files":["app.py","legacy_app.py","report.py","reproduce.py"],"app_argv":["python","app.py"],"report_argv":["python","report.py"]}`。声明文件为UTF-8源码/文本资产的相对普通文件，目录不得越界/链接；其它语言可在声明环境从源码构建到新输出。语言自由，argv列表不经shell；完整依赖需可在声明离线环境执行。运行器给app追加`--db PATH --authority PATH --request JSON_PATH`；给report追加`--evidence PATH --out PATH`。程序源码只读，输出新目录，1CPU、networknone；私有grader/参照答案不挂入程序。报告原数据只含自己的执行/数据库/命令，不给rubric权重或私有答案。

exercise_app.py是随公开输入交付的唯一完整演练执行器，不含正确迁移实现或私有评分。运行`python RAW/exercise_app.py --source SUBMISSION --raw RAW --out NEW_OUT`即可从公开原库复建全部故障/原命令/SQL及本submission报告。交付应另给操作者清楚的自含入口或等价可用命令，而非依赖私有评估工具。

app每次输出最后一行JSON，正常合同响应native exit0。请求action：status→ok/version/epoch；upgrade→upgraded或already_current/version/epoch；get(entry_id)→ok/entry或unknown_entry；balance→ok/balances逐customer_key/currency/amount_minor/fee_minor；notes→ok/notes；note(note_id,entry_id,text)→accepted/note_id；receipt(op_key)→ok/receipt或unknown_receipt；export→ok/tables包含DATA九表；recover(backup路径)→见运维来信。

write请求`{"action":"write","write":{"op_key":"...","entry_id":"...","epoch":4,"customer_key":"C-ALPHA","currency":"USD","amount_minor":500,"fee_minor":17,"reversal_of":null}}`。成功accepted/entry_id/epoch/source_schema2仅在COMMIT后；完整相同write同键→duplicate/receipt（原accepted不改），不同payload同键→operation_conflict。epoch不符优先stale_epoch/current_epoch；NULL/空身份或布尔/非整数→invalid_request:字段，外键/主键违反→constraint_error，错误退款invalid_reversal/refund_exceeds。无新副作用。v1请求字段customer_id/amount文本、source_schema1，其真实程序随档案提供。

upgrade和write追加`--pause-at before_commit|after_commit`时，必须在真实COMMIT之前/之后输出`{"event":"checkpoint","name":"...","pid":PID,"transaction_open":true或false}`并flush，等stdin一行换行再继续。评估侧另一连接检查实际库状态，必要时终止自己创建的该进程，随后新进程按原请求重试。旧应用另有before_begin握手；两旧写者跨切换后应stale_epoch，不要求观察SQLite内部锁队列。锁等待有界10秒是局部数据库行为，不是用户整题额度。

基例演练包括原读/批注→v1新ACK→SQLite备份→upgrade前中断/后中断/正常及两写者跨界→v2新fee/退款/原ACK查询/重复与冲突→新写提交前后故障→恢复→继续新业务与导出。各故障从原输入独立副本开始，不把一次破坏叠加为另一次初态。可另测明确身份歧义中止。无物理断电、任意恶意OS进程、远端文件系统或零停机要求。
