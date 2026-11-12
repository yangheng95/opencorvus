# 新增连接回执中断的真实桌面与项目证据

本人以隔离有头 Chrome 在实际开发服务 `/ui/` 交互并人工复核截图。透传只截断指定真实回执，本地协议进程和持久配置由应用产生。

## 基线

- [原输入和本地命令](01-baseline-add-input.png)
- [第一笔真实回执在途](02-baseline-add-pending.png)
- [截断后通用失败与已连接状态同时出现](03-baseline-add-conflicting-state.png)
- [原浏览器传输诊断](04-baseline-add-original-error.png)
- [真实回执、精确配置、项目状态和进程](baseline-first-mcp-draft-evidence.json)

## 改后

- [首轮原样输入](05-candidate-add-original-input.png)
- [在途继续编辑](06-candidate-add-new-draft-pending.png)
- [首轮观察与当前输入焦点](07-candidate-add-observed-draft-focus.png)
- [首轮中文观察](08-candidate-add-observed-chinese.png)
- [真实本地参数校验详情](09-candidate-add-local-validation.png)
- [完整回执正常关闭](10-candidate-add-normal-closure.png)
- [第二同名项目的新增输入](11-candidate-add-other-project-input.png)
- [首次观察后实时列表变化](12-candidate-add-timeout-first-attempt.png)
- [独立删除早于截断的结果](13-candidate-add-absent-after-delete.png)
- [第三项目读写双故障](14-candidate-add-double-failure.png)
- [两份原诊断](15-candidate-add-double-diagnostics.png)
- [自动恢复后的真实连接](16-candidate-add-recovered-list.png)
- [最终英文观察时点和较新草稿](17-final-add-observed-english.png)
- [最终中文观察时点和输入焦点](18-final-add-observed-chinese.png)
- [最终中文读取时未列出目标](19-final-add-absent-chinese.png)
- [最终原传输诊断](20-final-add-absent-diagnostic.png)
- [首轮五笔真实新增及项目证据](candidate-add-observations.json)
- [最终两笔真实新增及项目证据](final-add-observations.json)
- [首轮隔离数据库检查](candidate-storage-evidence.json)
- [最终隔离数据库检查](final-storage-evidence.json)
- [首轮隔离服务关停](candidate-stopped.json)
- [最终隔离服务关停](final-stopped.json)
