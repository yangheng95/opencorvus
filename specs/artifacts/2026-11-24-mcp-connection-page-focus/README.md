# 项目连接分页的桌面证据

基线 `41560/ui/` 的自有项目声明 23 条实际禁用连接。原图来自真实桌面，均已人工查看。

| 基线 | 观察 |
| --- | --- |
| [英文下翻](baseline-en-page-down-leaves-offscreen-connect.jpg) | 可见的是后段连接，原生焦点仍在屏幕外的连接 01。 |
| [中文上翻](baseline-zh-page-up-leaves-last-connect-offscreen.jpg) | 中文 160% 下出现前段连接，原生焦点还在下方的 23。 |
| [中文原焦点轮廓](baseline-zh-connection-action-ring-clipped.jpg) | 23 已完整滚进视区，按钮原生轮廓右侧仍被列表裁切。 |

第一版候选的 [中文分页](first-candidate-zh-focus-ring-clipped.jpg) 已聚焦正确的 13，实拍同样显示按钮轮廓右侧被裁切。

[真实焦点及视口](baseline-desktop-focus.json)与[项目状态接口返回](baseline-project-status.json)。

| 候选 | 观察 |
| --- | --- |
| [英文指引](verified-en-connection-list-guidance.jpg) | 项目范围、23 条状态、操作提示及原工具可见。 |
| [英文下翻](verified-en-page-down-complete-focus.jpg) | 18 的准确名称、禁用状态和连接焦点完整可读。 |
| [中文指引](verified-zh-connection-list-guidance.jpg) | 160% 下当前项目、提示和状态同屏。 |
| [中文上翻](verified-zh-page-up-complete-focus.jpg) | 13 的焦点环右缘和命名完整显示。 |
| [执行态所有权](candidate-execution-owned-row-retains-status-and-skips-focus.jpg) | 第一版候选的独立项目仍显示托管状态，普通操作按真实顺序接收焦点。 |

[第一版候选焦点](first-candidate-desktop-focus.json)、[最终候选焦点](verified-desktop-focus.json)与[真实执行态行序列](execution-owned-desktop-focus.json)。真实读取和数据核对见[基线](baseline-scope-proof.json)、[第一版](first-candidate-scope-proof.json)、[最终版本](verified-scope-proof.json)及[执行态范围](final-scope-proof.json)。
