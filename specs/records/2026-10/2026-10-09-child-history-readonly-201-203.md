# 2026-10-09 单 agent 子侧栏历史调查

## Recall

用户要求持续自主改进 Sources 与子 agent 侧栏 Rendering，最新要求只用单 agent；实际团队盘点仅 root。200在最终代码17cc7cfb证明主聊天两长回复5955/64+9903/70、同身份卸载/返回、15047高度和暂停阅读，以及原运行器/native整体0，不能替代子侧栏验收。当前交付起点6da1d8e6。

读[201方案](../../artifacts/2026-10-05-connection-workspace-authority/child-history-readonly-census-plan-201.md)、[202方案](../../artifacts/2026-10-05-connection-workspace-authority/child-history-frontier-audit-plan-202.md)与[203方案](../../artifacts/2026-10-05-connection-workspace-authority/child-history-startup-frontiers-plan-203.md)，从原153已闭合全库读取真实子树，未委托、启动副本、调用模型、重置旧 Task 或修改原历史。已读/搜索生产 Task lifecycle（生命周期）、Bus（消息发布）、租约、输入处置、权限、SessionControl（会话控制）、项目记忆与 bootstrap（启动初始化）路径。

## 已验证与限制

[201普查](../../artifacts/2026-10-05-connection-workspace-authority/child-history-readonly-census-201/README.md)真实90表、2 Projects/1 Task/5 Sessions，含 root→orchestrator→explore/delegated-worker 树，原生身份/端口/凭据清理重新核对，只读执行0。

[202当前合同](../../artifacts/2026-10-05-connection-workspace-authority/child-history-frontier-audit-202/README.md)实际结构无漂移/Task completed epoch1；139发布三阶段、1001投递、17 Provider 和14工具均匹配终态。工具链曾因隔离参数遗漏和Drizzle客户端识别失败而出错，补齐进程根并显式传入 readonly client，保留原错误与执行源，不误报原库损坏；末次独立退出码未保存，只报告实际生成结果和空stderr。

[203控制前沿](../../artifacts/2026-10-05-connection-workspace-authority/child-history-startup-frontiers-203/README.md)实际0，生产当前租约胜出项/不可变输入处置读取：三输入resolved/resolved/terminal_inapplicable；15助手完成；8权限执行和2checkpoint闭合；两项目记忆idle；三个无摘要Sources均在真实explore会话。永久进程身份记录按操作系统创建身份确认死亡，解释为持久化身份表示，未改写租约。

仍未完成174原生父工具汇合文件、项目文件配置/恢复语义、完整复制一致性、有限原生截止传递和实际子侧栏页面截图。库计数和匹配关系不作为 UI（User Interface，用户界面）验收。不新增/运行 UI 自动化测试，无产品代码、接口、配置、消息协议或版本变化，无发布。档案/索引/docs检查/范围提交/上游合并与推送；连续目标保持进行中，后续单 agent 继续实际侧栏准备。
