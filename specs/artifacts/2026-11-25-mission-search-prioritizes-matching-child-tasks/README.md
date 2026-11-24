# 组合搜索的子任务预览证据

隔离开发服务使用真实 Mission 会话、持久化子任务和公开读取。五条只读子任务用仓库现有夹具和真实协议建立，无模型请求。

- [组合词原版页面](baseline-cross-task-query.png)展示 Mission 匹配，三个可见子任务均不含组合查询的任何一词。
- [单词原版对照](baseline-single-term-prioritized.png)展示同一卡片上，旧版能把一个单词的准确子任务排在首位。
- [原列表读取](baseline-mission-read.json)固定原服务请求、会话与子任务身份，并显示原顺序中第 4、5 个任务各自对应的词。
