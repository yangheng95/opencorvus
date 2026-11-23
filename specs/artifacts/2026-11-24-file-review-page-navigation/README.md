# 文件审阅翻页键的真实桌面截图

在隔离的 OpenCorvus 开发服务 `/ui/` 中用浏览器真实键盘交互取图。原始桌面截图为 1280×720。正式会话包含 84 条实际保存的新增记录。

| 基线交互 | 原始截图 |
| --- | --- |
| 虚拟列表在第一条按 Page Down | [截图](baseline-virtual-after-page-down.jpg) |
| 虚拟列表在末条按 Page Up | [截图](baseline-virtual-after-page-up.jpg) |
| 值为 `review-sample-00` 的九条普通结果在第一条按 Page Down | [截图](baseline-normal-after-page-down.jpg) |
| 同一筛选在第九条按 Page Up | [截图](baseline-normal-after-page-up.jpg) |

| 首候选交互 | 原始截图 |
| --- | --- |
| 英文虚拟结果第一次向下翻页、连续向下及向上 | [第一次](candidate-en-virtual-first-page-down.jpg) · [连续](candidate-en-virtual-repeated-page-down.jpg) · [向上](candidate-en-virtual-page-up.jpg) |
| 英文明确选择并打开真实第 12 个文件 | [选择](candidate-en-virtual-select-page-result.jpg) · [磁盘内容](candidate-en-original-file-012.jpg) |
| 英文虚拟结果末端和向前翻页 | [末端](candidate-en-virtual-bottom-boundary.jpg) · [向前](candidate-en-virtual-page-up-from-end.jpg) |
| 英文九条普通结果下翻、上翻及边界选择 | [下翻](candidate-en-normal-page-down.jpg) · [上翻](candidate-en-normal-page-up.jpg) · [边界选择](candidate-en-normal-select-boundary.jpg) |
| 简体中文 160% 的九条普通结果和零条结果 | [下翻](candidate-zh-normal-page-down.jpg) · [上翻](candidate-zh-normal-page-up.jpg) · [空状态](candidate-zh-empty.jpg) |
| 简体中文 160% 的 84 条虚拟结果，上翻多移了一项 | [连续下翻到第三项](candidate-zh-virtual-page-down.jpg) · [上翻回第一项](candidate-zh-virtual-page-up.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文虚拟列表连续下翻及反向翻页后选择 | [下翻保留旧预览](final-en-virtual-page-down.jpg) · [上翻明确选择第 5 项](final-en-virtual-page-up-selected.jpg) |
| 英文和简体中文 160% 的普通列表，焦点在粘性标题下 | [英文](final-en-normal-page-up.jpg) · [中文](final-zh-normal-page-up.jpg) |
| 简体中文 160% 虚拟列表下翻两次并向上翻回一条 | [下翻](final-zh-virtual-page-down.jpg) · [上翻后空格选择第 2 项](final-zh-virtual-page-up-selected.jpg) |
| 最终选中记录的真实文件与磁盘内容 | [截图](final-zh-original-file-002.jpg) |
