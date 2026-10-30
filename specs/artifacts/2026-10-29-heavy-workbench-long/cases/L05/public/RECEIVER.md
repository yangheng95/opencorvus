# 合作HTTP副作用接收方协议

数据明示合成、仅USD整数minor units。服务只在自有loopback随机端口运行，不接触真实资金或第三方。这是完整任务的接收方层，业务/版本/修复合同见BUSINESS.md，不以此计数小时。

`POST /effects`必须恰有tenant、event_id、kind、amount_minor、reverses。身份符合`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`；amount_minor为JSON整数（bool不算），绝对值1到10^12。post金额正、reverses=null；reversal金额负、reverses为同租户post的event_id。HTTP body最多65536字节，唯一JSON键、有限JSON数，非法映射422/invalid_request及field。其他路径404/route_unknown。

严格静态schema验证后，先按tenant/event_id查已生效effect。同键同kind/amount/reverses返回200/replayed及原immutable receipt；同键不同合法静态载荷409/idempotency_conflict。身份不由传输尝试次数决定。然后才校验新reversal的前置post和累计冲正：前置未生效409/dependency_pending；累计绝对冲正超过原post409/reversal_exceeds_original。业务拒绝不占effect身份，同键在前置到达后可以成功。全额冲正已成功后重发同键仍为replayed。并发检查和插入在同一服务事务。

首次201/applied与查询200/found的receipt内容相同：receipt_id、tenant、event_id、kind、amount_minor、reverses。receipt_id由服务首次提交分配并持久；applied/replayed/found是外层状态，不属于receipt。`GET /effects?tenant=A&event_id=E1`恰需两个单值身份参数，返回200/found或404/unknown。凭连接失败不能判是否提交。候选只得URL，通过HTTP访问；只有评估侧可读取服务SQLite核对真实效果。requests表保存实际业务响应、receipt身份及故障消费事实，不能用候选sent=true代替服务证据。

requests持久记录范围为通过静态schema的POST业务响应及合法GET；422/路由错误保存在执行器实际HTTP原件，不声称服务表保存了所有HTTP请求。同键POST重试与GET后再处理都允许，验收以原收据/实际effect一致为准，不要求某一查询顺序、outbox命名或实现技术。

服务CLI `python l05_effects.py --db NEW_OR_EXISTING_DB [--drop-once TENANT/EVENT]`，stdout第一行ready包含自有PID与URL；stdin收到stop后正常关闭。drop-once由评估侧启动时注册，一次消费与首次effect共同提交，然后关闭socket不给HTTP响应；同DB重启不重复注入。未知ACK场景必须由真实首次POST建立，不预灌effect再伪称丢首次ACK。

评估侧还可显式设置`--hold-once TENANT/EVENT`，只在本服务进程第一次匹配的合法POST完成静态解析后、进入apply事务前握手。服务stdout发真实`held_before_apply`/PID/联合身份；此时GET与另一个同键POST继续处理。只有已领取停点后stdin `release`才发`hold_released`并释放原请求，随后`held_request_settled`记录其真实HTTP结果。没有已领取停点的release或其他控制返回invalid_control；stdin stop或EOF先释放所有等待再正常join。候选只得到HTTP URL，不得到operator stdin；这是可重放物理故障注入，不是模型流程控制。hold是单进程一次，不和持久drop-once混称同DB重启不再注入。

每个连接有从handler setup起算、不可按新字节续期的固定header/body读取截止，默认20秒；同一CLI可用`--read-timeout-seconds`指定正有限且不超过60秒的诊断窗口。完整header但body未读完而到期返回408/request_timeout；发送方向已EOF而实际body短于Content-Length时返回422/invalid_request/body_length。不完整header/空连接到期可直接关闭，不承诺JSON正文。完整读取后撤销并join读timer，已解码hold不继续消费该读取窗口；SQLite锁仍按20秒、socket写按当前read参数有界。请求线程明确非daemon，server_close等待请求结算，stop/EOF不能把serve_forever线程已join冒充业务请求已终态。该单请求治理不是用户或候选任务总预算。
