# 文件查看器路径的桌面证据

2026-11-22 独立项目与开发服务的 1280×720 原始浏览器画面。

| 基线画面 | 人工观察 |
| --- | --- |
| [打开北区文件](baseline-north-file.jpg) | 正文是北区，头部路径只显示公共前缀。 |
| [打开南区文件](baseline-south-file.jpg) | 正文是南区，头部仍显示相同前缀。 |
| [最窄右栏](baseline-narrow-south-file.jpg) | 路径更早被截断，仍能读到原保存状态。 |

| 候选画面 | 人工观察 |
| --- | --- |
| [英文北区](candidate-en-north.jpg) | 路径换行，保留 north 和文件名。 |
| [英文南区](candidate-en-south.jpg) | 头部读到 south，正文和保存状态仍清楚。 |
| [英文最窄右栏](candidate-en-narrow.jpg) | 路径自动折成三行，状态与预览仍可读。 |
| [英文临时草稿](candidate-en-dirty.jpg) | 源码出现临时文本，同时显示完整路径和未保存状态。 |
| [英文撤销](candidate-en-undo.jpg) | 正文、清洁状态和原编辑位置恢复。 |
| [中文南区](candidate-zh-south.jpg) | 在 280 像素右栏中同读南区路径及中文保存状态。 |
| [中文连续空格](candidate-zh-spaces.jpg) | 路径保留两个空格，预览仍完整。 |
| [中文根文件](candidate-zh-root.jpg) | 原文件名和保存状态保持简洁。 |

[实际搜索和读取回执](candidate-file-receipts.json)记录 4 个查询和 7 份隔离原始文件内容。
