# Task / Mission 当前 Goal 页面证据

[方案与Recall](../../records/2026-10/2026-10-20-goal-owner-ui.md)。主agent独立执行，当前正式462前端与当前源码后端，自有native开发/ui18747/18749、IAB tab7/tab8。用户18571、用户窗口/进程和真实用户数据库未操作。本轮为当前行为验收，没有产品源码改动；没有新增/运行UI自动化。

- Task：[真实已取消状态](task-current-state.png)、[精确Task归属和草稿预填](task-prefill.png)、[取消保留](task-cancel.png)、[同URL重载](task-reload.png)、[Mission运行后回访](task-after-mission.png)。Task未提交新的Goal；这些证据只覆盖当前表单、恢复和归属，不证明新Task Goal执行。
- Mission：[首次真实回复](mission-initial-result.png)、[精确Mission归属及预填](mission-prefill.png)、[取消](mission-cancel.png)、[同URL重载](mission-reload.png)、[一轮真实Goal](mission-goal-result.png)、[返回同一目标](mission-return.png)、[operator记录完成](mission-complete.png)。回复分别为MISSION463READY/MISSIONGOAL463READY；Goal使用canonical Session ID，41550令牌、1/1轮，完成author=user。
- 同一Document的实际搜索/选择：[Task→Mission](spa-mission.png)、[返回Task](spa-task-return.png)、[再返回Mission](spa-mission-return.png)。[操作记录](same-page-observations.json)说明实际command palette点击与独立草稿。它补齐首scope完整URL回访不能证明的同页control source切换范围。

15张原始1280×720截图全部人工查看。[首次实际Message/Part/事件](manual-ui-facts.json)、[首scope结果](results.json)、[首历史基线](history-verification.json)、[native结算](native-settlement.json)；[同页结果](same-page-results.json)、[最终历史](same-page-history.json)、[实际事实保留](same-page-preserved-facts.json)与[第二native结算](same-page-settlement.json)。所有Provider请求含Memory/preflight共8次，原定累计12次额度，均gpt-6.1-sol、streaming、HTTP200/eof；没有用二次scope重放Goal。

两scope均公开shutdown200，原49317/47462 exit0，物理/输出/请求/launcher结算，runtime复制对退休；[首private复制对](private-pair-retirement.json)和[后private复制对](same-page-private-pair-retirement.json)在实际秘密扫描后退休，源凭据元数据相同且未写入/交换/刷新。最终schema2、119 Project/161 Session，116/158与118/160两个基线所有原身份/归属/目录保留，Mission原Message/Goal事件与Task lifecycle精确相同。

仍未达：当前新Task Goal执行、桌面原生目录picker、原完整历史配置保存10s/恢复5s，以及侧agent直播Rendering的新验收。单纯未发现新的UI失败不表示长期迭代goal已完成。
