# 关于页任务列表状态实页证据

对应[根因、方案与验收](../../records/2026-11/2026-11-10-about-accepted-task-list-count.md)。以下独立真实开发 `/ui` 1280×720 原图由本人目视复核。

| 基线场景 | 原图 | 观察 |
| --- | --- | --- |
| 实际任务列表读回零项 | [直连](baseline-en-accepted-zero-task-list.jpg) | Connected / Browser / Tasks 0。 |
| 当前任务列表读取失败 | [截断实际读取](baseline-en-failed-task-list-shows-zero.jpg) | 后台健康仍在线，任务显示和真实零值一样。 |
| 当前无项目 | [关闭项目](baseline-en-no-project-shows-zero.jpg) | 技术详情确认没有当前目录，任务仍显示 0。 |

| 候选场景 | 英文原图 | 简体中文原图 |
| --- | --- | --- |
| 真实响应尚未接受 | [Not loaded](candidate-en-task-list-pending.jpg) | [重开项目后尚未加载](candidate-zh-reopened-project-pending.jpg) |
| 原完整响应已接受、实际 0 条 | [Loaded tasks 0](candidate-en-task-list-accepted-zero.jpg) | [已加载任务 0](candidate-zh-reopened-project-accepted-zero.jpg) |
| 任务读取失败、后端仍在线 | [Unavailable](candidate-en-task-list-unavailable.jpg) | [不可用](candidate-zh-task-list-unavailable.jpg) |
| 正常关闭当前项目 | [No project selected](candidate-en-no-project.jpg) | [未选择项目](candidate-zh-no-project.jpg) |

[真实读取和关停回执](receipts.json)记录原任务列表、受控截断和完整传输、实际词典与独立数据检查。
