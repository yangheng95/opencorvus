# 服务商目录行焦点的证据

[规格与验收记录](../../records/2026-11/2026-11-11-provider-row-identity.md) · [基线及候选真实接口回执](api-evidence.json)。

- [基线真实读取在途](01-baseline-bedrock-focused.png)保留筛选和 Bedrock 的配置焦点。
- [基线响应到达](02-baseline-focus-dropped.png)后同一 Bedrock 显示 67 个模型，配置轮廓消失。
- 候选英文目录在[读回前](03-final-bedrock-pending.png)与[读回后](04-final-bedrock-focused.png)保持同一 Bedrock 配置焦点，[Enter 展开该行](05-final-bedrock-enter.png)。
- 候选中文自定义行在[读回前](06-final-custom-pending.png)与[读回后](07-final-custom-focused.png)保持编辑焦点，[Enter 打开原配置](08-final-custom-enter.png)。
- 停留在重试按钮时，[读回后继续搜索](09-final-search-handoff.png)；关闭项目后，[同一筛选在全局范围无匹配](10-final-global-scope.png)。
