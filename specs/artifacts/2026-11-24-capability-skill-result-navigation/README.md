# 技能分配搜索的真实桌面证据

基线 `41580/ui/` 使用真实对话与通用工作设置。两张图分别为英文 100% 和简体中文 160%，均经本人查看。

| 基线 | 观察 |
| --- | --- |
| [英文对话下翻](baseline-en-chat-skill-page-down-retains-old-result.jpg) | 页面显示后段说明和勾选框，焦点仍是屏幕外的 18。 |
| [中文通用工作上翻](baseline-zh-work-skill-page-up-retains-old-checkbox.jpg) | 当前看见的是前段技能，原生焦点仍停在靠后的 01。 |

[焦点和几何](baseline-desktop-focus.json)与[两产品正式库存与分配](baseline-skill-assignment-proof.json)。

[首版候选展开 07](first-candidate-en-chat-expansion-clips-description.jpg) 确认焦点到达实际技能，展开拉长的一行仍裁去说明正文的底部。

最终构建 `41584/ui/` 的截图记录两个产品的搜索、原生控制和原作者内容。

| 最终候选 | 观察 |
| --- | --- |
| [英文技能查询](final-en-chat-skill-search-guidance.jpg) | 实际项目、对话的查询和键盘说明可见。 |
| [英文展开完整正文](final-en-chat-expanded-description-visible.jpg) | 页末 07 展开后仍能看到行标题、焦点、复选框和作者原文。 |
| [确认准确分配](final-en-chat-assignment-and-original-description.jpg) | 保存 07 后原文及原行焦点保持。 |
| [返回英文搜索](final-en-escape-keeps-skill-query-and-details.jpg) | Escape 回到原词和搜索位置。 |
| [中文技能查询](final-zh-work-skill-search-guidance.jpg) | 160% 下可读自然换行的中文说明与原查询。 |
| [中文勾选框翻页](final-zh-work-checkbox-page-keeps-complete-skill.jpg) | 07 的准确勾选框、身份和说明可见。 |
| [唯一匹配](final-zh-single-skill-description.jpg) | 实际 `wheel-storage` 的原作者说明可读。 |
| [空匹配](final-zh-work-search-empty-feedback.jpg) | 明确反馈没有符合条件的技能，独立连接区可用。 |
| [连接分配](final-zh-work-connection-assignment-regression.jpg) | 通用工作连接的原键盘导航仍能聚焦准确行。 |

[首版焦点](first-candidate-desktop-focus.json)与[最终焦点](final-desktop-focus.json)。正式接口、数据和回执见[基线](baseline-end-proof.json)、[首版保存](candidate-selected-proof.json)、[首版恢复](candidate-restored-proof.json)、[最终初始](final-before-proof.json)、[最终保存](final-selected-proof.json)和[最终恢复](final-restored-proof.json)。
