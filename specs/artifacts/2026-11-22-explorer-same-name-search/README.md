# 资源管理器同名文件搜索的桌面证据

2026-11-22 独立开发服务的 1280×720 原始浏览器截图。文件是本批自行创建的示例。

| 基线画面 | 人工观察 |
| --- | --- |
| [同名搜索结果](baseline-search-results.jpg) | 两个文件名都被截断，目录只显示相同前缀。 |
| [键盘聚焦第二项](baseline-keyboard-selected.jpg) | 页仍展示同一前缀，无法从当前行看到南区。 |
| [实际打开第二项](baseline-south-file.jpg) | Enter 打开后读取 South handoff 及仓储示例数字 23。 |

| 候选画面 | 人工观察 |
| --- | --- |
| [英文同名结果](candidate-en-list.jpg) | 两个完整文件名旁分别显示 `…/north` 与 `…/south`。 |
| [方向键聚焦南区](candidate-en-keyboard-focused.jpg) | 第二条聚焦时可立即读到南区路径。 |
| [实际南区内容](candidate-en-south-file.jpg) | Enter 打开 South handoff，正文数字为 23。 |
| [最窄右栏](candidate-en-narrow.jpg) | 两个文件名与区别目录均完整。 |
| [英文三个同名目录结果](candidate-en-details.jpg) | Root folder、`…/north/team` 与 `…/south/team` 同时可见。 |
| [实际北区团队正文](candidate-en-north-team-file.jpg) | 鼠标打开正确的北区团队文件。 |
| [中文三个同名目录结果](candidate-zh-details.jpg) | 「根目录」本地化，真实路径段保留原文。 |
| [实际根目录文件](candidate-zh-root-file.jpg) | 点击中文列表首条打开 Root procedures。 |
| [中文唯一结果](candidate-zh-unique.jpg) | 文件名完整，保留其原父目录说明。 |
| [中文清空搜索](candidate-zh-cleared.jpg) | 恢复原树和搜索框焦点。 |

[真实文件搜索与读取回执](candidate-file-receipts.json)包含 3 个查询、6 个文件及其原始文本。
