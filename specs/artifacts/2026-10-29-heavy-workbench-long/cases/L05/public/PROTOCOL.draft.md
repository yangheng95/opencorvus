# 合作副作用mini协议（未冻结）

数据明示合成、仅USD整数minor units。服务只在自有loopback随机端口运行，不接触真实资金或第三方。此协议是L05的局部可达性资格，完整任务/版本语义尚未交付，不以此计数小时。

`POST /effects`必须恰有tenant、event_id、kind、amount_minor、reverses。身份符合`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`；amount_minor为JSON整数（bool不算），绝对值1到10^12。post金额正、reverses=null；reversal金额负、reverses为同租户post的event_id。HTTP body最多65536字节，唯一JSON键、有限JSON数，非法映射422/invalid_request及field。其他路径404/route_unknown。

严格静态schema验证后，先按tenant/event_id查已生效effect。同键同kind/amount/reverses返回200/replayed及原immutable receipt；同键不同合法静态载荷409/idempotency_conflict。身份不由传输尝试次数决定。然后才校验新reversal的前置post和累计冲正：前置未生效409/dependency_pending；累计绝对冲正超过原post409/reversal_exceeds_original。业务拒绝不占effect身份，同键在前置到达后可以成功。全额冲正已成功后重发同键仍为replayed。并发检查和插入在同一服务事务。

首次201/applied与查询200/found的receipt内容相同：receipt_id、tenant、event_id、kind、amount_minor、reverses。receipt_id由服务首次提交分配并持久；applied/replayed/found是外层状态，不属于receipt。`GET /effects?tenant=A&event_id=E1`恰需两个单值身份参数，返回200/found或404/unknown。凭连接失败不能判是否提交。候选只得URL，通过HTTP访问；只有评估侧可读取服务SQLite核对真实效果。requests表保存实际业务响应、receipt身份及故障消费事实，不能用候选sent=true代替服务证据。

requests持久记录范围为通过静态schema的POST业务响应及合法GET；422/路由错误保存在执行器实际HTTP原件，不声称服务表保存了所有HTTP请求。同键POST重试与GET后再处理都允许，验收以原收据/实际effect一致为准，不要求某一查询顺序、outbox命名或实现技术。

服务CLI `python l05_effects.py --db NEW_OR_EXISTING_DB [--drop-once TENANT/EVENT]`，stdout第一行ready包含自有PID与URL；stdin收到stop后正常关闭。drop-once由评估侧启动时注册，一次消费与首次effect共同提交，然后关闭socket不给HTTP响应；同DB重启不重复注入。未知ACK场景必须由真实首次POST建立，不预灌effect再伪称丢首次ACK。

局部参考worker有独立业务SQLite：ingest将账与pending outbox原子提交；drain按原联合身份查询服务，unknown才POST，收到匹配immutable receipt才记录confirmed。transport_unknown是可恢复待对账状态，不是accepted false或另造key。自有worker可在after_remote_receipt_before_local_commit发PID/阶段握手并等stdin，评估侧只中断其原Popen句柄，独立核对两个库，再重启同键恢复。这个观测探针不是正常业务运行条件。

最小账为A/E1+100、B/E1+200、A/R1−30引用A/E1：逐身份三效果，租户A70/B200。并发重复、服务重启、冲突A/E1+101、前置未到达再到达、全额冲正重发和两个超额合计冲正都用真实HTTP/SQL核对。故障最终解除，之后给正常请求收敛机会；无限故障下有限时收敛不在合同中。
