# 已选会话工具栏的桌面验收

## 基线

`40396/ui/` 的真实开发服务通过 `40400` 本地转发。接收目标项目 `/path` 的真实 200 后短暂保留，同一响应经手动放行。页面互动作于两个同名项目下不同的真实记录。

- [南区通用工作对话已载入](baseline-en-south-work-loaded.jpg)
- [英文载入北区多步任务时仍显示 Work · Chat](baseline-en-north-mission-loading.jpg)
- [英文北区多步任务载入后显示 Code · Mission 与原文](baseline-en-north-mission-loaded.jpg)
- [反向切换至南区通用工作对话](baseline-en-south-work-loading.jpg)
- [中文载入北区多步任务时仍显示通用 · 对话](baseline-zh-north-mission-loading.jpg)
- [中文北区多步任务载入后显示编程 · 多步任务](baseline-zh-north-mission-loaded.jpg)
- [英文北区项目路径待转发及手动放行](baseline-north-handoff.json)
- [英文南区项目路径待转发及手动放行](baseline-south-handoff.json)
- [简体中文北区项目路径待转发及手动放行](baseline-zh-north-handoff.json)
- [两个项目中精确选择的规范返回](baseline-exact-selection.json)
