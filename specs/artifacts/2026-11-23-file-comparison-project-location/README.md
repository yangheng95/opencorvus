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

## 候选

`40410/ui/` 重放原两个项目和同相对路径文件，另复核含连续空格的长路径。

- [北区文件比较中的完整目标](candidate-en-north-comparison-location.jpg)
- [完整长路径换行及保留的空格](candidate-en-long-comparison-location.jpg)
- [南区文件比较中的完整目标](candidate-en-south-comparison-location.jpg)
- [实际重读后的南区基线与磁盘差异](candidate-en-south-disk-update.jpg)
- [简体中文采用前的完整路径、磁盘与草稿](candidate-zh-south-before-adoption.jpg)
- [采用基线后保留原南区草稿](candidate-zh-south-after-adoption.jpg)
- [键盘重开，编辑器基线与实际磁盘文本一致](candidate-zh-south-adopted-base-comparison.jpg)
- [候选两个正式项目身份](candidate-projects.json)
- [候选比较前的三个文件正式读取](candidate-before-comparison.json)
- [单独变更的实际南区磁盘内容](candidate-controlled-disk-change.json)
- [实际采用后对原文件的正式读取](candidate-after-adoption.json)
- [两套隔离数据库的实际运行计数](isolated-runtime-counts.json)
