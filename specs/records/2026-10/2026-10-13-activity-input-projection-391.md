# 391 历史活动与交接输入归属

[Recall及共享影响](../../artifacts/2026-10-05-connection-workspace-authority/activity-input-projection-plan-391.md) · [真实证据](../../artifacts/2026-10-05-connection-workspace-authority/activity-input-projection-391/README.md)

单agent开发。390实际刷新后多出英文交接预览，根因是Session transcript活动投影和Task有界SQL读取均把user输入当产出，而实时路径把它放入inputPreview。两条历史读取现按Message.role=assistant选择产出，SQL先分类再排序/限额；完整Message、inputPreview、来源和公共数据形状不改。

修前0pass/4fail中3项复现真实活动污染，1项是新测试缺Session ledger。修后第一轮17pass/1fail，补真实生产ledger后聚焦4项通过，其余14项已通过。覆盖多轮、并行、24项限额、分批读取、运行中/完成/失败Tool和真实输入可读性。types通过；没有UI自动化。

第一个Native scope在真实Provider过载时失败，成员error Message被delegate工具错误地发布为completed并转为ZodError；原Message、Tool、全部协议事件和截图00保留，已立即按共享终态机制横向审计，见[未完成调查](../../artifacts/2026-10-05-connection-workspace-authority/activity-input-projection-391/delegate-error-audit.md)。本轮不声称修好此新问题。

新的独立after scope完成7次真实Sol流式请求。人工截图01/02确认刷新前后进展一致，03/04确认完整交接输入仍可读，05确认Source打开原文件并选中2—3行。规范checker以实际input/assistant Message和Part身份比较HTTP活动与完整产出，保留完整inputPreview；同时校验Source→Tool→Message、终态及SSE回放。after Host89084/Target69688在353887ms结算；两个scope都已关闭原页面和句柄、释放端口并清理auth/models复制对。live的6次HTTP200/EOF只代表传输闭合，包含一个成员业务失败。

文档和正常push检查记录在完整证据中。后续优先修复委派错误传播/终态收敛，继续审计尚未排除的Mission、SessionActor、CLI/ACP和恢复消费者；原Research Studio长历史尚未重放。整体goal未完成。
