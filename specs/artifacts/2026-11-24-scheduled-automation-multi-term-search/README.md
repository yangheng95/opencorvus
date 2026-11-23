# 定时任务多词检索的真实桌面截图

真实 OpenCorvus 隔离开发页，加载经公开接口保存的六项计划、两个项目与一个实际会话。截图为原始 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 单词可以查到北门和西门，加入名称中的另一个词后出现空结果 | [单词](baseline-en-single-receiving-works.jpg) · [分隔词](baseline-en-separated-words-miss-names.jpg) |
| 英文项目范围以实际指令和目录名组合，仍是空结果 | [项目跨字段](baseline-en-project-path-and-prompt-no-results.jpg) |
| 中文 160% 会话标题中的单词可查到，混合标题和指令后出现空结果 | [单词标题](baseline-zh-single-title-word-works.jpg) · [会话跨字段](baseline-zh-session-title-and-prompt-miss.jpg) |
