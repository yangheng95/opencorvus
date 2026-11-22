# 文件比较位置的桌面验收

## 基线

`40408/ui/` 的隔离真实开发服务上，两个 `site-notes` 项目各有不同的 `notes/receiving.txt`。

- [北区文件编辑器和实际内容](baseline-en-north-editor.jpg)
- [北区比较只显示相对路径](baseline-en-north-relative-comparison.jpg)
- [南区未保存草稿](baseline-en-south-editor.jpg)
- [南区比较与北区显示相同位置](baseline-en-south-relative-comparison.jpg)
- [英文重新读取南区磁盘改动，出现采用基线动作](baseline-en-south-new-disk-comparison.jpg)
- [简体中文南区比较，磁盘与草稿内容分离](baseline-zh-south-new-disk-comparison.jpg)
- [两个正式项目身份](baseline-projects.json)
- [两个实际文件的正式读取](baseline-file-reads.json)
