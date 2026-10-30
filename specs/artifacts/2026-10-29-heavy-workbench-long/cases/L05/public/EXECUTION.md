# 软件与真实执行协议

submission.json含files（全部相对普通UTF-8源码/文本资产）、app_argv列表、report_argv列表、logical_map文件名。语言可不同，依赖需在声明Linux离线环境可运行；argv不经shell。应用追加--db LOCAL --url LIVE_URL --request JSON_FILE --input PUBLIC_RAW [--pause-at NAME]。actor UID10001仅能写自己本地DB；不给live receiver DB路径/读权限。receiver由执行者单独owner启动，源码/公开raw只读，networknone但容器内部loopback真实HTTP可用。

stdout为机器JSON行协议，诊断日志写stderr；带pause-at调用的第一行是相应checkpoint，最终一行是合同响应。每次普通软件原子调用/释放checkpoint后的完成窗口为90秒，等待owner持有的checkpoint期间不计这个完成窗口；这是局部软件协议，不是整个agent任务额度。首次source构建应符合声明环境并在调用前准备好，不能用这个接口调用LLM或远端安装依赖。

request action：init（自动保原数据补建当前持久结构，initialized）；ingest(epoch,event)→accepted/seq、duplicate/同seq、transport_conflict、stale_epoch/epoch、paused/epoch、unknown_tenant、invalid_request/field；adjustment(epoch,tenant,adjustment_id,amount_minor,approval)→approved/duplicate/adjustment_conflict/adjustment_out_of_domain或治理拒绝；note(epoch,tenant,note_id,body)→accepted/duplicate/note_conflict或治理拒绝；pause(epoch,repair_id)→paused/already_paused、epoch/boundary_seq/snapshot；repair同参→resumed/epoch/repair_id或repair_complete；resume未完成→repair_incomplete；reconcile→converged；monitor(window_id)→ok/sample/transitions或duplicate/sample；status→ok/control/cuts。正常合同响应native exit0。checkpoint之前的重复请求也必须原结果，不能因原epoch旧而丢ACK。

原在途请求从冻结旧库提取完整已登记wire，由frozen_sender.py只消费该wire和URL发送；它不查询/更新候选当前库，因此不要求兼容旧postings表/trigger。这个明确受owner hold的历史sender在release前不设自身HTTP读总时限，避免20秒抢先否定每个合法90秒原子调用；release后由owner finish的90秒与receiver有界请求结算治理，失败cleanup只管自己的PID。普通应用HTTP默认20秒不变，历史sender也不是无限故障收敛保证。

pause的snapshot含四原事实表逻辑行及intent_keys(tenant,event_id,payload)。cuts逻辑行repair_id/epoch/boundary_seq/snapshot_json/phase/completed_epoch，阶段paused/settled/planned/complete；对外暴露的是完整持久事实，内部实现不限。计划完成checkpoint后，直到该cut完成且新事实接受前，键集合不得变化。固定场景epoch从1至2；后续真实reconcile不隐式丢accepted或重置generation。

--pause-at为before_accept_begin（开启接受事务前）、after_accept_commit（真实提交后ACK前）、before_http（第一条未确认intent读好后HTTP前）、after_remote_receipt_before_confirm（真实收据到达而本地未确认）、after_plan_commit（完整补偿计划真实提交后）。达到时flush单行JSON {event:checkpoint,name:NAME,pid:实际PID,detail:...}，等stdin一行换行。HTTP点detail含tenant/event_id；收据点还含receipt。执行者独立SQL核实际提交状态，只控制自己Popen句柄，不信checkpoint自述。单原子调用90秒无输出握手失败会保进程/SQL并结束该调用；receiver请求读界20秒。这些局部故障协议不限制agent总工作时长。

logical_map.json把logical_store.py的十张逻辑表/字段映射到实际SQLite表或视图/列：{"journal":{"table":"your_table","columns":{"seq":"your_seq",...}},...}。用实际对象名，不收任意SQL。允许额外元数据/表列；必需字段、原事实与新承诺按真实值验收，行序/表名不作质量门。payload/snapshot_json为JSON全文，原字段文本须保留；新JSON的等价键序/空白不扣分。samples字段window_id/pending/total/pending_ratio/conflicts/mismatched_sources/active_json，alerts字段window_id/alarm/status；pending_ratio为有理串（等价未约分可），active_json为告警名数组JSON。

公开exercise.py只含执行/真实观察，不含正确修复、私有oracle或rubric。运行python RAW/exercise.py --source SUBMISSION --raw RAW --out NEW_OUT，或交付自己的自含reproduce入口。执行完整事故/在途/两修复中断/双接受者/双sender/receiver重启/监测/零分母，再最后用UID65534只读原事实副本执行report_argv --evidence FACTS --out NEW_DELIVERY；原事实owner700、只读投影555/444，report仅delivery可写，结束才导出。所有过程/失败/真实本地与receiver SQL/PID/native均保留；不挂私有grader/权重/旧答案，不需要凭据。
