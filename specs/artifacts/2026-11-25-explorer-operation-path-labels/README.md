# 文件操作路径说明证据

## 基线

- [带两个前导空格文件的 Rename](baseline-leading-rename.png)，[普通文件的 Rename](baseline-plain-rename.png)。
- 两个说明的原生可访问名称相同，视觉仅有小幅空白差别。两次均取消，仅核对说明。

## 候选真实桌面

- [带空格文件 Rename](candidate-leading-rename.png)，[普通文件 Rename 对照](candidate-plain-rename.png)，[Copy](candidate-leading-copy.png)，[Move](candidate-leading-move.png)，[Delete 确认](candidate-leading-delete-confirmation.png)。这些操作仅查看后取消。
- [真实新建冲突摘要](candidate-real-create-conflict.png)，[409 原诊断与请求编号](candidate-real-conflict-details.png)，[在原表单修正后的真实成功结果](candidate-real-create-success.png)。
- [中文成功回执](candidate-chinese-create-success.png)，[中文 Rename](candidate-chinese-rename.png)，[中文搜索目录提示](candidate-chinese-directory-detail.png)，[中文目录目标](candidate-chinese-directory-target.png)，[中文目录新建说明](candidate-chinese-directory-create.png)。
- [显示名搜索与三个实际文件内容回执](candidate-file-identities.json)。正文同时与磁盘原文核对。

所有截图均来自专用 Chrome 的真实开发 `/ui/`，本人使用当前 Computer Use 原生窗口接口交互并查看。新增空文件仅位于本人隔离项目，未操作用户原有文件。
