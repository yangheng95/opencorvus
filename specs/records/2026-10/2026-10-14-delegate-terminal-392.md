# 392 委派错误与首次终态

[Recall与共享审计](../../artifacts/2026-10-05-connection-workspace-authority/delegate-terminal-plan-392.md) · [证据与边界](../../artifacts/2026-10-05-connection-workspace-authority/delegate-terminal-392/README.md)

391真实模型过载时，child已保存error Message，delegate却先发completed再因空handoff抛ZodError。首次终态保护正确拒绝后续覆盖，因此根因是调用方错误的发布顺序。修复将共享AgentRunError转换移到唯一轻量模块，并要求delegate检查实际Message归属、硬错误、取消、已完成回复及非空交接后才发布成功；每个返回后的终态绑定确切输入和最终Message。原失败Message、Part与事件保留，公共成功JSON不变。

15项聚焦后端正向检查通过，包含部分输出错误、输出上限、取消竞争、多Project并行及重入回放；修前基线和夹具自身失败均保留。typecheck、docs与架构索引通过。真实页面7次Sol流式请求正常完成，Sources点开准确高亮2—3行，刷新保持一致；DB、HTTP与SSE均匹配同一final Message和唯一completed事件。147737ms后Native资源、页面、句柄和复制凭据全部闭合。

本次未再发生真实Provider错误，不能把局部错误测试当修后真实过载端到端资格。原Research Studio长历史、Task/Mission完整恢复矩阵及ACP独立错误投影尚未全部完成。单agent开发持续进行，未停止整体goal。
