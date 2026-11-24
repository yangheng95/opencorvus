# 完整模型服务商目录的桌面证据

实际 Windows 桌面 1280 × 720。基线 `41650/ui/` 加载 `main-Cl0OupMa.js`。英文 100%，简体中文 160%。

| 基线截图 | 观察 |
| --- | --- |
| [英文公开目录下翻](baseline-en-full-provider-page-leaves-configuration-focus.jpg) | 正文显示其他服务商，真实 302.AI 配置按钮的焦点在视口外。 |
| [英文混合目录下翻](baseline-en-mixed-page-leaves-edit-focussed-offscreen.jpg) | 画面已滚到公开目录，焦点仍在离屏的原仓库中继 Edit 按钮。 |
| [英文混合目录回车](baseline-en-mixed-enter-opens-original-editor.jpg) | 实际又打开旧仓库中继的原表单及本机地址。 |
| [中文未筛选上翻](baseline-zh-page-up-does-not-move-provider-action.jpg) | 可见其他服务商，末项的焦点仍离屏。 |
| [中文带词对照](baseline-zh-query-existing-page-action.jpg) | 输入「模型」后同一真实目录的上翻已移动到 Vultr，完整焦点环可读。 |

[实页动作及实际焦点](baseline-desktop-focus.json)、[正式项目配置和公开目录的身份](baseline-provider-identities.json)。

候选 `41652/ui/` 加载 `main-C_f1Yhct.js`。同一桌面与缩放设置，人工查看以下实页截图。

| 候选截图 | 观察 |
| --- | --- |
| [英文未筛选入口](candidate-en-full-provider-directory-guidance.jpg) | 空搜索显示翻页说明，两条自定义声明在公开目录之前。 |
| [英文完整目录上翻](candidate-en-full-provider-page-focus.jpg) | 从 iFlow 返回 Cohere，完整名称和 Configure 焦点环可读。 |
| [英文打开 Cohere](candidate-en-cohere-configure.jpg) | Cohere 显示 Done 和原配置编辑器。 |
| [英文打开交接中继](candidate-en-handoff-edit.jpg) | 实际内嵌编辑器聚焦交接中继的地址，列出原模型。 |
| [中文 160% 上翻](candidate-zh-full-provider-page-160.jpg) | 未筛选目录聚焦 Vultr，末项仍显示在视口下沿。 |
| [中文打开 Vultr](candidate-zh-vultr-open-160.jpg) | 完整呈现服务商名称、模型数、收起按钮焦点和密钥输入行。 |
| [中文精确单项](candidate-zh-one-provider-match-160.jpg) | 唯一项保留原身份、模型数量与可见操作焦点。 |
| [中文无匹配](candidate-zh-no-provider-match-160.jpg) | 空结果有本地化说明，焦点留在有词搜索框。 |

[实页动作及实际焦点](candidate-desktop-focus.json)、[桌面按钮显示顺序](candidate-desktop-provider-order.json)、[正式项目配置和公开目录的验收读数](candidate-provider-identities.json)。
