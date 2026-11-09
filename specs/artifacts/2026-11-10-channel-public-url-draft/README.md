# 通道公网地址草稿：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-channel-public-url-draft.md)。使用两个独立临时项目、真实开发服务和同源透传。所有地址仅为 `.invalid` 项目配置元数据，未打开这些地址、连接通道或发送附件。透传只延迟原项目保存回执，未改变响应内容。

| 前态 | 本人复核所见 |
| --- | --- |
| [01](before-01-first-draft-ready.jpg) | 首次草稿与键盘聚焦的 Save。 |
| [02](before-02-newer-draft-before-first-receipt.jpg) | 原保存尚未确认，输入框已有第二份地址且处于焦点。 |
| [03](before-03-first-receipt-overwrites-newer-draft.jpg) | 收到第一份保存回执后，仍聚焦的输入被改回第一份。 |

| 候选与最终 | 本人复核所见 |
| --- | --- |
| [04](after-04-saving-keeps-keyboard-focus.jpg) | 初轮候选忙时保留保存焦点，按钮宽度仍会变。 |
| [05](after-05-first-receipt-keeps-newer-draft.jpg) | 初轮候选保留新草稿和焦点，提示和焦点边框相贴。 |
| [06](after-06-english-save-width-ready.jpg) | 最终候选英文待保存的字段和按钮。 |
| [07](after-07-english-saving-width-stable.jpg) | 最终候选忙时按钮与输入的边界和待保存状态一致。 |
| [08](after-08-english-draft-and-separated-receipt.jpg) | 实际较早回执、较新草稿及焦点同屏，提示与输入留出间距。 |
| [09](after-09-chinese-unsaved-draft-notice.jpg) | 切到中文后的同一草稿和提示。 |
| [10](after-10-chinese-newer-address-confirmed.jpg) | 明确提交较新值后的中文成功回执及保存焦点。 |
| [11](after-11-reopened-project-shows-confirmed-address.jpg) | 重开页面采用已确认值，原目录仍可用。 |

[前态透传](before-proxy.jsonl)、[候选透传](after-proxy.jsonl)记录实际项目写入与交付回执；[前态读回](before-settled-tcp.json)、[首轮候选读回](after-first-tcp.json)、[最终旧值](after-review-tcp.json)和[最终新值](after-settled-tcp.json)来自直接真实接口。[项目只读审计](owned-final-check.json)记录磁盘值、写入身份和隔离范围，[首轮候选关停](candidate-shutdown.json)与[最终候选关停](after-shutdown.json)是正常关停回执。
