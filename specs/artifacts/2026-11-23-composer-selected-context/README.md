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

## 候选

`40398/ui/` 的真实开发服务通过 `40402` 本地转发。英文暂缓跨项目路径读取，简体中文暂缓项目水合后的精确记录读取。截图为本人桌面实际操作的原图。

- [英文新建入口的既有 Work · Chat](candidate-en-launcher.jpg)
- [英文北区项目路径等待中，工具栏显示 Mission](candidate-en-north-mission-loading.jpg)
- [英文北区记录接受后，工具栏显示 Code · Mission](candidate-en-north-mission-loaded.jpg)
- [同一多步任务的只读对话上下文](candidate-en-mission-readonly-context.jpg)
- [反向切换到通用工作对话，等待中仍是 Work · Chat](candidate-en-south-work-loading.jpg)
- [通用工作对话正常载入](candidate-en-south-work-loaded.jpg)
- [中文北区记录等待中，工具栏显示多步任务](candidate-zh-north-mission-pending-read.jpg)
- [中文北区记录已载入，工具栏显示编程 · 多步任务](candidate-zh-north-mission-loaded.jpg)
- [新建对话实际选择编程用途](candidate-zh-launcher-mode.jpg)
- [北区项目路径真实响应的等待与放行](candidate-en-north-path.json)
- [南区项目路径真实响应的等待与放行](candidate-en-south-path.json)
- [北区精确选中读的等待与放行](candidate-zh-north-selection.json)
- [两个项目精确读取的原记录](candidate-exact-selection.json)
- [隔离数据库的会话、消息、任务和模型活动计数](isolated-runtime-counts.json)
