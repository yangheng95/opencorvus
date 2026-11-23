# 模型服务商搜索结果的真实桌面截图

真实 OpenCorvus 隔离开发页，公开目录和一个无凭据的自有项目配置。原图为 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 只有一个公开匹配，Down 仍停在搜索 | [目录配置](baseline-en-provider-search-down.jpg) |
| 英文搜索匹配自定义及目录两条，Down 仍在输入 | [混合结果](baseline-en-mixed-search-remains-in-input.jpg) |
| 英文鼠标打开自有服务商的现有内联编辑器 | [实际编辑器](baseline-en-edit-opens-correct-inline-form.jpg) |
| 中文 160% 同样两条，Up 仍在搜索 | [高缩放基线](baseline-zh-up-does-not-enter-provider-results.jpg) |

| 最终实际交互 | 原始截图 |
| --- | --- |
| 英文 100% Down 进入自定义编辑，再 Down 进入具名的 OpenAI 配置 | [第一项](candidate-en-first-edit-action.jpg) · [下一项](candidate-en-next-catalog-action.jpg) |
| 英文回车打开正确的内联表单，普通 Tab 继续到原有独立测试按钮 | [真实表单](candidate-en-enter-opens-exact-edit.jpg) · [Tab 顺序](candidate-en-tab-remains-on-separate-test-control.jpg) |
| 中文 160% 显示键盘提示，Up 自动滚到目录末项 | [搜索](candidate-zh-search-hint-and-two-results.jpg) · [目标配置](candidate-zh-up-reveals-catalog-action.jpg) |
| 中文原生回车在同一公开目录项展开和收起配置 | [展开](candidate-zh-enter-expands-public-config.jpg) · [收起](candidate-zh-enter-collapses-public-config.jpg) |
| 中文同一目录中继续在不同的具体服务商配置之间移动 | [相邻结果](candidate-zh-adjacent-catalog-provider.jpg) |
| 中文空结果保留键盘输入，Escape 清除并恢复目录 | [空结果](candidate-zh-no-results-keeps-search.jpg) · [恢复目录](candidate-zh-escape-clears-search-and-restores-catalog.jpg) |
