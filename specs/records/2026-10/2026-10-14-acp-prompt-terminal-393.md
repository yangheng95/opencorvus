# 393 ACP提示结果与取消收尾

[Recall、根因与共享横审](../../artifacts/2026-10-05-connection-workspace-authority/acp-prompt-terminal-plan-393.md) · [证据](../../artifacts/2026-10-05-connection-workspace-authority/acp-prompt-terminal-393/README.md)

普通ACP提示与注册命令原来丢弃SDK/error Message，固定返回end_turn。现以真实input和最终Message统一映射end_turn/max_tokens/refusal/cancelled，其他错误通过官方RequestError返回原诊断；usage取规范total，未知命令和失败compact具有明确错误结果。

真实流式取消揭示公共执行Promise提前拒绝、已保存取消Message却向ACP返回通用500。公共HTTP writer现捕获实际owner，只在确切取消时等待该owner物理finish，再读同input已结算回复；init使用规范completed-reply返回boolean。没有改全局首终态/取消机制、没有第二套状态或伪Message。

规范修前2pass/8fail；最终14项真实协议集成、12项转换、13项公共身份/并行/replay/恢复合同通过，共39项不同测试。原失败和夹具问题均归档。compact实际拒绝来自无可压缩材料，已核对持久SessionControl；不拿它证明外部Provider压缩故障。types、docs348/26、architecture19通过。无UI改动/自动化和外部凭据使用。

运行前取消、跨进程取消/完整Task与Mission恢复、流式通知竞态、原Research Studio长历史还需继续验收。单agent持续工作，整体goal未完成。
