# 定时任务详情返回的真实桌面截图

隔离 OpenCorvus 开发页，操作经正式接口持久化的远期定时定义。原图为 1280×720。

| 英文 100% 基线 | 原始截图 |
| --- | --- |
| 从搜索用方向键到中间的西门计划 | [打开详情之前](baseline-en-middle-result-before-detail.jpg) |
| 回车打开西门后回车返回，焦点回到搜索 | [返回后的焦点](baseline-en-return-loses-middle-result.jpg) |
| 继续按 Down 从第一条北门开始 | [实际后续焦点](baseline-en-down-restarts-at-first.jpg) |

| 额外基线及最终交互 | 原始截图 |
| --- | --- |
| 中文 160% 旧版鼠标打开西门后返回，焦点落在搜索 | [原有行为](baseline-zh-pointer-return-focuses-search.jpg) |
| 英文 100% 最终版回到中间的北门，再 Down 到下一条场院 | [恢复真实行](final-en-restores-middle-row.jpg) · [下一条](final-en-down-continues-to-next.jpg) |
| 英文创建取消和编辑取消仍接续各自的真实页面 | [创建后返回搜索](final-en-create-cancel-returns-to-search.jpg) · [编辑后返回西门详情](final-en-edit-cancel-returns-to-detail.jpg) |
| 中文 160% 最终版鼠标打开西门和返回，继续按 Down 到北门 | [鼠标返回](final-zh-pointer-returns-to-west.jpg) · [按键进入北门](final-zh-resumed-navigation-to-north.jpg) |
| 北门从已暂停中移出后，返回保留筛选及输入焦点，并可浏览西门 | [原已暂停详情](final-zh-open-paused-plan-before-state-change.jpg) · [返回搜索](final-zh-filtered-out-origin-keeps-search.jpg) · [继续浏览](final-zh-navigation-from-search-to-available-plan.jpg) |
| 中文切换已启用，实际展示北门原 2099 年时间 | [更新后的列表](final-zh-active-list-shows-updated-north.jpg) |
