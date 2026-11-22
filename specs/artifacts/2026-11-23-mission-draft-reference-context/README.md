# 多步任务草稿引用上下文的桌面验收

## 基线

真实隔离项目开发服务 `40404/ui/` 上，北区草稿已保存 `@mission("general")`，南区草稿没有显式引用。

- [英文北区草稿，正文有引用而上下文显示首条消息为空](baseline-en-mission-draft-context.jpg)
- [普通南区草稿也被标为首条消息来源](baseline-en-plain-draft-context.jpg)
- [简体中文同一北区草稿和上下文](baseline-zh-mission-draft-context.jpg)
- [同一身份的公开工作记录、空消息读取与正式技能目录](baseline-draft-and-catalog.json)

## 候选

真实 `40406/ui/` 复查相同项目和请求，并通过多步任务页面更改南区原请求。

- [英文北区草稿显示已保存来源与实际技能](candidate-en-mission-draft-context.jpg)
- [英文南区无引用草稿显示正确的保存请求空态](candidate-en-plain-draft-context.jpg)
- [中文北区草稿的来源、显式引用和技能说明](candidate-zh-mission-draft-context.jpg)
- [真实编辑南区草稿加入引用](candidate-zh-edit-draft-request.jpg)
- [从保存回执打开同一南区草稿，显示新增的实际引用](candidate-zh-updated-draft-context.jpg)
- [新建工作的现有模式和可编辑引用入口](candidate-zh-new-work-reference-controls.jpg)
- [原南区草稿在归档列表及其新请求](candidate-zh-archive-row.jpg)
- [同一归档会话的完整请求与只读引用](candidate-zh-archived-draft-context.jpg)
- [编辑前两个记录与正式技能目录](candidate-draft-and-catalog.json)
- [保存并归档后的精确身份、请求及空消息读取](candidate-after-edit-archive.json)
- [两套隔离数据库的实际运行计数](isolated-runtime-counts.json)
