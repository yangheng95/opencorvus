# 定时任务多词检索的真实桌面截图

真实 OpenCorvus 隔离开发页，加载经公开接口保存的六项计划、两个项目与一个实际会话。截图为原始 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 单词可以查到北门和西门，加入名称中的另一个词后出现空结果 | [单词](baseline-en-single-receiving-works.jpg) · [分隔词](baseline-en-separated-words-miss-names.jpg) |
| 英文项目范围以实际指令和目录名组合，仍是空结果 | [项目跨字段](baseline-en-project-path-and-prompt-no-results.jpg) |
| 中文 160% 会话标题中的单词可查到，混合标题和指令后出现空结果 | [单词标题](baseline-zh-single-title-word-works.jpg) · [会话跨字段](baseline-zh-session-title-and-prompt-miss.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文 100% 逆序、大小写和全角空格匹配两条原计划 | [全局列表](candidate-en-reordered-names-and-wide-space.jpg) |
| 英文用名称和指令词定位西门，键盘打开后返回同一行 | [正确详情和空历史](candidate-en-cross-field-west-details.jpg) · [返回焦点](candidate-en-search-result-survives-return.jpg) |
| 词分别来自两个不同计划，得到原有空结果 | [实际空结果](candidate-en-separated-definitions-empty.jpg) |
| 在项目范围依次核对一个绑定项目、两个绑定项目及正式规则标识 | [指令加路径](candidate-en-project-path-and-prompt.jpg) · [两个绑定项目](candidate-en-one-plan-matches-both-projects.jpg) · [规则加名称](candidate-en-literal-rule-and-name.jpg) |
| 中文 160% 以已暂停和会话范围查找标题和指令，打开并返回原行 | [实际搜索](candidate-zh-session-title-and-prompt.jpg) · [暂停详情](candidate-zh-exact-session-details.jpg) · [绑定会话和真实指令](candidate-zh-linked-session-and-stored-prompt.jpg) · [返回焦点](candidate-zh-filtered-session-row-after-return.jpg) |
