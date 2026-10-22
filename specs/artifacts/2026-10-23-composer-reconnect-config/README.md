# 重连时模型配置读取

[调查与方案](../../records/2026-10/2026-10-23-composer-reconnect-config.md)；[原请求、诊断、数据与资源事实](evidence.json)。六张截图均由内置浏览器实际交互、人工查看；没有 UI 自动化断言。

- 修复前：[已读取模型](01-model-ready.png) → [重连错误](03-first-reconnect.png) → [后续完整加载补读](05-later-recovery.png)。同一模型读取 generation5 在旧健康状态=false时本地抛出 `Cannot load session config while disconnected`；原单调时钟约8.487秒后才由下一次加载补读成功。
- 修复后：[正常基线](06-fixed-ready.png) → [同页离线](07-fixed-offline.png) → [同页恢复](09-fixed-restored.png)。generation5同样在connected=false时进入，却直接请求真实Session/config；服务1735ms返回200，前端原读取1819.2ms后发布ready。其后workspace完整加载保留同一模型。

两页均保留原35个正文owner和11个来源owner，阅读位置top=64017。实际打开模型选择器并搜索6.1，看到已选GPT-6.1 Sol，随后Escape关闭，没有改模型或发送消息。截图08捕获于服务尚在恢复阶段，不当作已恢复的通过证据；首轮Details点击时提示已消失，错误原文取自原函数观测日志。

原始控制台capturedAt可能晚于发出时间，延迟取同页原performance.now（字段at），不混用两种时钟。serverReads是此页面触发的真实目标配置GET日志。本批没有独立checker向该Session/config发请求。

四个服务各2次current Sol预检，共8/16次流式200/EOF；原exec/native/launcher均0，输出/request和精确进程出生结算，16份runtime/private认证+模型目录配对成员退休。全部90表、原字段/时间和canonical源保持，目标原行仅两条运行租约变化，schema3。全局健康状态与发送/写入控制仍按原契约处理，未将流连接当成整个workspace已恢复。
