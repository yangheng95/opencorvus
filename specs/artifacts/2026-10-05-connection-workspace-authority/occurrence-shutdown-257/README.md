# 257 待命退出与真实历史收敛

[实施前Recall与共享审查](../occurrence-shutdown-plan-257.md)。上一轮256真实自然结束三输入，在原服务退出后最后输入又被记录aborted；本轮修复生命周期生产者并进入真实新进程历史页面。

## 根因与当前实现

[原256真实持久事件](original-256-protocol.json)显示最后输入先idle，关闭服务再写aborted，预检输入相同。Prompt物理拥有者跨输入待命，原Scope释放该拥有者后按保留的末次身份无条件发布取消，普通/精确Scope及公共Session/右栏各有同语义写入。正文完成不能判定Task/Mission业务终态，取消callback也不能判定其pendingDelivery消息已被接管。

现唯一executionStates保留真实发布的idle，executionOccurrence派生实际已发布status；尚未首次发布的接管输入与真实idle区分。取消receipt在任何abort之前捕获同精确拥有者的未结束输入；普通/精确Scope共用该对象发布原取消状态及原因。已结束输入保留，未接管排队消息沿原投递 authority。公共Session/右栏删除末次身份补写，沿同Scope与原归档保留开关。Task/Mission高层领域封闭、handoff和队列事实仍由原领域拥有者提供。

新的同步资源退出检查还证明原callback拒绝顺序丢失取消来源：owner.abort监听器先执行finish，给排队调用注入LoopFinishedError。已在同cancelMatch先登记receipt、拒绝/取走callback，再取消monitor/owner；monitor异常也在finally请求owner退出。该真实失败日志保留，期望没有降低。

## 检查

- 新Scope与公共HTTP、两Project关闭及原Task监听器路径7项/17断言通过。
- 原输入生命周期与已settle终态发布9项/20断言通过。
- 原Session载入/历史/事件流16项/70断言通过。共32数据检查/107断言，均非UI自动化。
- 当前后端与Overlay类型实际0；没有改UI源码或前端Schema，使用原256实际构建的`main-2GYrCS_Q.js`，以真实页面复核数据呈现。

## 真实Sol与物理退出

原生服务`live-01`固定600000毫秒/12请求，端口18193，自己的IAB100。完整auth/models资格与真实gpt-6.1-sol流式已核对。实际11请求均200/eof、原Native0、原前台15843实际join0、独立closure0；归档实际13795新日志/未知时间0。精确Native74584/birth `win32:639271880687722561` 与Host31484均离开，端口与完整复制对已退休。

真实主Session `ses_-zUSOfRyyzzJaIjT298A`、Project `prj_h3KiY1UCLvrJtJdDXcGH`，三个输入分别为`msg_d174bd06-09d5-48fa-9250-bd33a0acb0c0`、`msg_b25a0ffd-37f1-423b-a070-552f9c23ce2a`、`msg_cf6653ef-a18c-4d30-8f63-d1c84e640ebe`。模型实际读取W3C/MDN两个页面并在首轮保存一条真实memory，后两轮直接答复；全部实际工具与输出保留。

[第三轮运行截图](live-01/third-current.jpg)与[活动栏](live-01/third-current-rail.json)在2026-10-10T00:18:53.434Z显示前两轮idle、第三轮running。[自然结束来源截图](live-01/before-shutdown-sources.jpg)与[三输入状态](live-01/before-shutdown-rail.json)显示三个idle，来源标题/域名与首轮定位清楚。自己的页面关闭、唯一服务退出后，[原当前数据库](live-01/closed-protocol.json)保留三轮idle，最后输入退出时追加的原idle也保留其事实，没有改写旧256记录。

## 新进程真实历史

先核对原服务完整关闭、全部90表、2Project、7完成assistant、14恢复入口、真实权限结果、当前控制/执行容量、项目记忆与有效配置。永久runtime_process claim是历史PID/出生身份，使用实际OS死亡判据；不能按MAX过期时间误当活调度租约。历史工具原Task-only无法读取普通源，扩展同一个私有copy/launch primitive，显式task/session subject且核对真实表行，全schema/全部行直接内容比较保持。

原检查工具错误（权限虚构表、把普通Markdown记忆当JSON、把永久进程声明按时间作busy）保留并按当前生产契约修复。所有资格重新执行后才启动新历史服务；没有fixture消息、模型生成或新Task。

新服务`history-01`固定900000毫秒，自己的IAB101/端口18194，Native78772/birth `win32:639271896085999098`、Host52184。实际[公共历史投影](history-01/actual-historical-public-view.json)与[新进程页面](history-01/opened-real-history.jpg)、[三轮活动栏](history-01/opened-real-history-rail.json)在2026-10-10T00:42:24.036Z为三个idle。[历史Sources](history-01/historical-sources.jpg)标题/域名完整，第一输入导航仍正确。该服务刻意未配凭据/模型目录，模型不可用提示明确保留已有记录可读；不把它误报为原Sol凭据问题，也没有发送新请求。

原前台4325实际join0、Native0/物理output/request完成，独立关闭与端口/凭据对核对通过，224新日志/未知0。[数据custody](history-01/actual-history-custody.json)证明12个核心历史表全部行内容等同、20条生命周期完整等同、原项目文件元数据保持；Provider request/outcome表与原Source完全等同，没有新增模型执行。新runtime/Bus/read记录保持自身进程来源。

## 边界

真实普通Sol三轮、物理退出与新进程历史/Sources已验收；活跃Provider流的实际停止、Task/Mission真实重试/恢复和更宽分页矩阵本轮没有资格证据。相关数据检查及代码审查不能替代那些真实验收。无新成员/分支/工作树/版本发布。目标保持进行中。
