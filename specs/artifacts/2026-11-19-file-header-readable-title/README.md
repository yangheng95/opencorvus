# 文件栏标题优先显示验收

## 基线

- [默认宽度下截断了短文件名](baseline-en-default-width.png)
- [最小宽度的根目录文件英语标题](baseline-en-minimum-root-title.png) · [同一文件的中文界面](baseline-zh-minimum-root-title.png)
- [最小宽度的独立只读来源](baseline-zh-minimum-readonly-title.png)

本人操作 `40272/ui/` 的真实页面并逐图核对，构建入口是 `main-HtEAPlma.js`。两份项目文件与一份独立来源的真实接口读取均为 200，精确等于磁盘 167、125、66 字节。英文和中文的最小宽度通过工作台实际分隔条取得。

## 候选

- [英语默认宽度完整名称](candidate-en-default-width.png) · [英语最小宽度完整名称](candidate-en-minimum-root-title.png) · [较宽时同一工具行](candidate-en-wide-same-row.png)
- [原按钮查找实际匹配](candidate-en-minimum-find.png) · [保存前真实草稿](candidate-en-minimum-dirty.png) · [真实保存完成](candidate-en-minimum-saved.png)
- [中文最小宽度完整根文件标题](candidate-zh-minimum-root-title.png) · [返回原指南](candidate-zh-returned-guide.png) · [继续键盘定位下一链接](candidate-zh-continued-keyboard-link.png)
- [真实来源的完整只读标题](candidate-zh-minimum-readonly-title.png) · [快捷键查找并选中原文](candidate-zh-readonly-keyboard-find.png) · [关闭文件后回到资源管理器](candidate-zh-closed-to-explorer.png)

本人操作 `40274/ui/` 的真实页面并逐图核对。构建入口是 `main-7y8P_Z_V.js`。项目文件 `review-notes.txt` 实际保存前 125 字节，保存后 162 字节，原内容与明确追加的 37 字节精确拼接，通过真实接口和磁盘核对。独立来源 66 字节保持原件。
