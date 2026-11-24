# 原生文件监视和 Git 状态实证

- [外部写入前已经展开的环境栏](baseline-git-environment-before-external-edit.jpg)。当前分支为 `main`，工作树干净。
- [外部写入已有真实监视事件，环境栏仍显示原状态](baseline-watched-external-edit-leaves-git-stale.jpg)。
- [手动刷新后显示真实的一个修改](baseline-manual-git-refresh-shows-real-change.jpg)。
- [Windows 原生事件、规范读取和此工作树的证据](baseline-native-git-refresh-receipts.json)。

## 当前实现

- [主项目实际外部写入后自动显示一个修改](candidate-primary-shows-external-edit.jpg)。
- [独立项目同名文件的变化更新自己的 `control` 状态](candidate-control-checkout-owned-change.jpg)。
- [主项目恢复干净后提醒无可提交更改，主题草稿保留](candidate-external-restore-keeps-commit-draft.jpg)。输入仍获焦。
- [原生事件、工作记录投影、两项目请求和最终 Git 状态](candidate-native-git-refresh-receipts.json)。
