# 模型服务商目录和搜索状态的证据

[规格与验证记录](../../records/2026-11/2026-11-11-provider-catalog-read-status.md) · [真实读取回执](api-evidence.json)。截图来自本人在隔离桌面页实际操作，只裁切设置内容；展开的诊断原图含本机路径，留在临时目录。

- [基线首次失败](01-baseline-first-read-failed.png)仍显示 0/0；[基线保留旧目录](03-baseline-retained-catalog-failure.png)仍显示 1/88。[基线仅认证失败](04-baseline-auth-only-failure.png)则确实读到了目录。
- [最终首次失败](05-final-en-first-failure.png)、[原位重试等待](07-final-en-retry-waiting.png)和[恢复](08-final-en-recovered.png)：始终保留 Bedrock，读到结果后才显示 1/88 与模型数。
- [真实目录无匹配](09-final-en-true-empty.png)：正常情况下仍有 0/88 和具体无匹配提示。
- [中文保留旧目录](10-final-zh-retained-catalog.png)明确说明来源；[仅认证读取失败](11-final-zh-auth-only.png)仍展示有效的目录与模型数。
- [全局读失败](13-final-zh-global-retained.png)和[只读重试恢复](14-final-zh-global-recovered.png)同样区分上次读取与已接受目录。
