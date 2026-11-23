# 定时任务筛选结果的真实桌面截图

OpenCorvus 隔离开发页，四项经正式接口保存的计划，实际桌面视口 1280×720。

| 基线操作 | 原始截图 |
| --- | --- |
| 英文 100% 搜索得到三项，Down 后仍在输入框 | [截图](baseline-en-down-remains-in-search.jpg) |
| 英文打开北门计划并按回车返回列表 | [截图](baseline-en-detail-back-retains-origin.jpg) |
| 中文 160% 筛为已暂停，Up 后仍在输入框 | [截图](baseline-zh-up-remains-in-search.jpg) |

| 候选交互 | 原始截图 |
| --- | --- |
| 首次候选的键盘轮廓被裁掉左右边 | [裁剪前](intermediate-en-clipped-focus-outline.jpg) |
| 英文 100% 向下聚焦第一项，继续到第二项并打开北门正文及空历史 | [完整轮廓](final-en-first-full-inset-focus.jpg) · [正确详情](final-en-middle-result-opens-north.jpg) |
| 英文返回后向上进入末项，Tab 到该项的独立删除按钮 | [末项](final-en-return-and-last-result.jpg) · [独立删除按钮](final-en-tab-reaches-separate-action.jpg) |
| 中文 160% 筛选已暂停、全局，聚焦末项，再移动到上一项并用回车打开北门 | [末项](final-zh-paused-global-last.jpg) · [上一项](final-zh-adjacent-first.jpg) · [正确详情](final-zh-opens-correct-paused-plan.jpg) |
| 中文切换到没有匹配的项目范围，然后清除筛选 | [空结果和输入焦点](final-zh-empty-project-retains-search.jpg) · [恢复全部四项](final-zh-clear-filters-restores-all.jpg) |
