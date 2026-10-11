# 316 子会话补全与实时观察顺序

[实施前Recall与分析](../../artifacts/2026-10-05-connection-workspace-authority/source-read-order-plan-316.md)。单agent，先验证真实读取对请求前实时观察的接管。

已实现当前HTTP完成值对请求前持久化live观察的接管，保留请求中事件、未落盘文字和工具草稿。资源完成和显示投影使用同一个读取结果，再清理原live队列，避免先清理导致旧base短暂回显。71项数据/生产路由检查180个断言通过，类型/构建通过。

初次测试有两项输入契约错误，已按来源不可变和新行orderKey契约修正并保留原日志。更正输入后的旧project对照出现3个错误输出，新reconcile后真实路由通过。真实/ui18285已人工查看来源、跨Project各自内容、重新选择子会话、列表往返和重开。自己的页面、原执行器和Native/Host均已结算；保护表内容相同。没有新模型请求或agent。[完整证据与限制](../../artifacts/2026-10-05-connection-workspace-authority/source-read-order-316/README.md)；原全部流式闪烁仍需继续验证。
