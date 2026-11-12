# 批量删除回执中断的真实桌面与项目状态

本人在隔离有头 Chrome 以真实鼠标和键盘操作 `/ui/`，人工复核截图。透传只截断指定真实响应。配置持久化、状态和进程由开发服务与本地协议进程产生。

## 基线

- [原项目的两个实际删除目标](01-baseline-original-delete-targets.png)
- [真实完整响应暂扣时的界面](02-baseline-delete-held.png)
- [截断后空列表与通用失败同时出现](03-baseline-delete-conflicting-error.png)
- [原浏览器传输诊断](04-baseline-delete-original-diagnostic.png)
- [真实回执、原项目配置、另一项目状态及进程退出](baseline-mcp-delete-evidence.json)

## 改后

- [首轮英文精确确认](05-candidate-delete-absent-confirm.png)
- [原项目两个目标均未列出](06-candidate-delete-targets-absent.png)
- [原始传输诊断](07-candidate-delete-original-details.png)
- [第二项目中文确认](08-candidate-partial-confirm-chinese.png)
- [等待回执期间重配的同名目标仍列出](09-candidate-partial-same-name-observed.png)
- [第三项目双故障前确认](10-candidate-double-cut-confirm.png)
- [首轮双故障提示](11-candidate-double-cut-warning.png)
- [首轮两份原始诊断](12-candidate-double-cut-details.png)
- [首轮自动恢复后待修整的措辞](13-candidate-first-double-cut-recovered.png)
- [重配连接再次明确删除](14-candidate-normal-confirm.png)
- [完整回执与正常焦点](15-candidate-normal-delete-completed.png)
- [最终英文首次读失败提示](16-final-double-cut-english.png)
- [最终中文及两份原始诊断](17-final-double-cut-chinese-details.png)
- [最终自动恢复后显示实际空状态](18-final-double-cut-recovered.png)
- [另一同名项目仍有自己的两条连接](19-final-other-project-preserved.png)
- [首轮四笔真实删除、项目状态及进程退出](candidate-delete-observations.json)
- [最终删除、读取截断与恢复](final-readback-evidence.json)
- [最终删除与两项目持久状态](final-mcp-delete-evidence.json)
- [首轮隔离数据库检查](candidate-storage-evidence.json)
- [最终隔离数据库检查](final-storage-evidence.json)
- [首轮隔离服务关停](candidate-stopped.json)
- [最终隔离服务关停](final-stopped.json)
