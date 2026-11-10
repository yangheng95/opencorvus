# 提供方模型地址契约的证据

[规格、根因及接口回执](../../records/2026-11/2026-11-11-provider-catalog-optional-api-url.md)。图片来自隔离服务的真实桌面页，本人逐张查看；只裁切设置内容区。

- [基线：公开目录刷新后](03-baseline-catalog-after-write.png)：页面已能列出 236 个提供方，但正式接口声明仍不接受其中 1,173 个条目。
- [候选：搜索 Cerebras](05-candidate-cerebras-catalog.png)和[展开配置](06-candidate-cerebras-expanded.png)：保留两个目录模型，已配置数为零，凭据未输入。
- [候选：搜索 Amazon Bedrock](07-candidate-bedrock-catalog.png)：保留 163 个目录模型，其中有 146 个未声明自定义地址；页面依然准确列出提供方。
