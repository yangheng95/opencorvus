# MCP连接管理当前实页证据

对应[方案与完整结果](../../records/2026-10/2026-10-28-mcp-connection-current-journey.md)。

- [汇总](runtime-review.json)：15张人工查看的原图，三次冻结资源、范围与限制。
- [原加载错误借用全局行](01-current-mcp-settings-en.jpg)、[实际配置官方服务](02-official-local-server-form-en.jpg)、[原已连接行缺少控制](03-connected-server-without-control-en.jpg)。
- [原错误的正确Project边界](04-project-load-error-has-owned-boundary-en.jpg)；04是中间构建中已经通过的读取归属实现，该实现与最终构建相同。06展示中间构建的顶部等待块造成布局跳动，不能当最终视觉证明。
- [最终紧凑等待/焦点](08-compact-connect-pending-focus-en.jpg)、[连接后轮询焦点](09-connected-poll-focus-retained-en.jpg)、[键盘断开完成](10-keyboard-disconnect-settled-en.jpg)、[新增提交等待](11-add-pending-admission-en.jpg)、[两个真实连接](12-two-real-connected-servers-en.jpg)。08–15均为main-BQOHnBym。
- [双语动作](13-two-connected-actions-zh.jpg)、[断开一个保留另一个](14-one-disconnected-other-connected-zh.jpg)、[中文键盘重连焦点](15-keyboard-reconnected-focus-zh.jpg)。
- [连接事实](connection-facts-reviewed.json)：官方包实际2.0.1/Node>=24、两个持久定义、六个真实UI POST均200、各阶段状态/原进程、没有模型请求。官方资料：https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem。未调用文件写入工具或更改模型工具分配。
- [六个MCP原进程物理核对](mcp-physical-reviewed.json)、三份retirement：原实例91318/86584/2113、native/launcher全部0，公开shutdown200，物理/输出/请求结清后退休三份自有catalog，未复制认证，源catalog与auth元数据保持；共用30分钟截止，最终清理余量400937ms。
- [数据保留](all-rows-reviewed.json)：98278原行精确保持，三自有实例分别98283/98285/98287行，schema9及integrity ok。原业务输入保持。

仅聚焦非UI服务测试6项13断言通过，配合类型、普通构建和真实页面；没有UI自动化测试。远端OAuth、模型实际调用MCP工具、破坏性删除与所有平台尚未逐一验收，不宣称全部MCP功能完成。
