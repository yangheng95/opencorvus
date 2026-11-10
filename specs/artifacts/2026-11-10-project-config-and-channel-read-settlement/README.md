# 项目配置与通道目录独立读取实页证据

对应[调查、实施与验收](../../records/2026-11/2026-11-10-project-config-and-channel-read-settlement.md)。图片来自独立真实开发 `/ui`、1280×720，手工交互后已目视复核。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线慢目录 | [通用授权未加载](baseline-en-general-waits-for-catalog.jpg)、[通道地址也等待](baseline-en-channel-address-waits-for-catalog.jpg) | 配置 200 已原样传输，仅目录被扣留；通用和地址仍不可用。 |
| 基线放行目录 | [地址与目录](baseline-en-channel-after-catalog.jpg)、[通用授权](baseline-en-general-after-catalog.jpg) | 原目录回执放行后，两处才同时出现配置结果。 |
| 候选先完成配置 | [通用授权](candidate-en-general-config-before-catalog.jpg)、[地址与目录等待](candidate-en-address-before-catalog.jpg)、[原样放行](candidate-en-both-resources-settled.jpg) | 真实配置先可用；只有目录等待，之后正常显示目录。 |
| 候选先完成目录 | [中文目录先可读](candidate-zh-catalog-before-config.jpg)、[配置放行](candidate-zh-catalog-and-config-settled.jpg) | 目录和文档入口先显示；原地址和编辑操作随实际配置成功出现。 |
| 原项目目录迟到 | [切到另一项目后](candidate-zh-peer-before-old-catalog.jpg)、[原响应放行后](candidate-zh-peer-after-old-catalog.jpg) | 实际新项目 `config-peer` 的地址和目录前后一致。 |

[公开读取与传输回执](receipts.json) 记录两个项目的精确归属、实际状态、请求身份、放行时序及隔离库计数。没有操作授权、保存设置、打开文档外链、使用凭据或模型。
