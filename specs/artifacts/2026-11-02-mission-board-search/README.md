# 任务看板可见内容搜索（894）

真实开发CLI（Command Line Interface，命令行接口）38615/38616的`/ui/`，本人隐藏页面；不操作用户18571。全部截图人工复核，不使用UI（User Interface，用户界面）自动化测试或截图基线。仅只读原数据，没有构造业务实体或模型消息。

| 截图 | 实际观察 |
| --- | --- |
| 01-before-request-search-en.jpg | 原卡片请求片段搜不到 |
| 02-before-child-task-search-en.jpg | 原子Task名搜不到 |
| 03-before-cross-field-search-en.jpg | 项目名+标题组合搜不到 |
| 04-before-result-summary-search-en.jpg | 原结果摘要搜不到 |
| 05-before-original-task-order-en.jpg | 原身份可找到同一741，原子Task顺序 |
| 06-after-request-search-en.jpg | 请求片段命中原888，帮助说明范围 |
| 07-after-open-original-request-en.jpg | 搜索后实际打开同一原请求 |
| 08-after-child-task-priority-en.jpg | 子Task命中并优先预览，进度/失败数保持 |
| 09-after-result-summary-en.jpg | 结果命中同一原741 |
| 10-after-cross-field-en.jpg | 项目名与标题词共同命中原886 |
| 11-after-normalized-path-en.jpg | 正斜杠路径命中同项目原885/886 |
| 12-after-project-filter-intersection-en.jpg | 搜索与项目筛选正确取交集 |
| 13-after-reset-original-order-en.jpg | 重置恢复全部原工作和Task顺序 |
| 14-after-cross-field-help-zh.jpg | 中文帮助及混合大小写跨字段搜索 |
| 15-after-no-match-reset-zh.jpg | 中文无结果及明确重置入口 |
| 16-after-clear-original-order-zh.jpg | 实际重置/输入/Escape后恢复原数据展示 |

`verification.json`含类型/本地化/CSS/文档/构建、两阶段全旧数据资格和原生资源闭合回执，以及实页交互前后13条公共reader完整相等的身份摘要。两语言帮助关联为只读浏览器事实，不是自动化断言。08/14保存原图另经本地复核。源数据最多2个子Task，三项以上/单独受阻事项和子Task描述词/失败读取像素未单独实测。0模型请求、累计1260不变；全部旧数据、100项目文件与Git、229附件保全。
