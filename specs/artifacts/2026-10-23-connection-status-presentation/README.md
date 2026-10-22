# 连接状态统一表达实页证据

[方案与根因](../../records/2026-10/2026-10-23-connection-status-presentation.md)；[实际状态、请求、数据与资源记录](evidence.json)。八张实图均已由负责修改的单agent实际查看；没有UI自动化测试。

## 后端重启后的同页恢复

1. [在线基线](06-verified-online.png)：原35段正文、11条来源与选中成员。
2. [真实离线](07-verified-offline.png)：红色离线角标与后端不可达提示一致。
3. [英文恢复中](08-english-recovering.png)：原事件流已连接，健康请求尚未通过网络，角标和提示均为黄色Connecting。
4. [中文恢复中及Sources](10-chinese-source-recovering.png)：通过真实Settings切换中文，原提示即时翻译；来源标题/域名与正文仍可读。
5. [健康恢复后在线](11-chinese-online.png)：释放实际健康请求后正常在线，手工选定的top=62577保持。

页面172保持原URL和authority。私有转发器只暂停真实GET /global/health的转发，其他请求/响应原字节传递；20:18:00.936启用，20:19:45.353由操作者释放，未达到120秒边界。实际客户端超时与后续200分别记录，没有伪造响应、消息或UI状态。

## 转发器修正后的复验

[英文提示](14-final-english-banner.png)、[中文提示](15-final-chinese-banner.png)、[最终在线](16-final-online.png)。页面173在同一服务持续提供真实事件时延迟健康请求，经历实际传输超时与提示宽限期；再手工切换语言、释放网络并恢复。原来源、正文、owner及top=62577保持。图15中的设置tooltip来自返回设置入口的实际焦点/悬停，图16已用Escape关闭。

首次转发器虽然正常关闭，却在复用socket时重复注册close监听器，出现MaxListenersExceededWarning。已修正为按物理socket去重注册并重跑同一实页资格；最终152次原样转发、19个物理上游socket注册，注册时close监听器总数均为3，原exec94785退出0且没有新增输出。原exec73294的告警与正常结算分别保留，不回写旧证据。

五个后端各2次current OpenCorvus Sol预检，共10/12次流式200/EOF。全部后端/两转发器原exec正常0，client/upstream socket、pending/request均0且输出排空；20份runtime/private auth与完整models配对成员退休。原90表165802行/所有字段时间/canonical保持，目标原行仅两条运行租约变化，schema3。独立流持续断线提示、ResizeObserver及Mission实页仍为后续范围。
