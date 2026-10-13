# 持续目标 UI/UX 证据

[方案与Recall](../../records/2026-10/2026-10-14-continuous-goal-ui-ux.md)记录当前范围、权限、预算与验收矩阵。用户要求停止子agent后，由主agent独立实施与验收。

- [改动前Chat桌面](screenshots/before-chat-desktop.jpg)：已实际呈现并人工查看。
- [私有运行合同](independent-runtime-plan.md)、[运行器](private-runtime.ts)：前期准备，现由主agent接管；不包含UI自动化。
- runtime-1保留检查器原失败与完整清理；runtime-2正式`/ui`已完成验收并关闭。真实请求固定总上限96，跨服务重启累计。

首轮runtime1/2的UI/UX验收通过：主agent独立实现与手工复核，6个目标完成、10个真实自动轮次、24个真实请求（包含原检查器失败的2个请求）。全部实际模型为`gpt-6.1-sol`，runtime2的22个流式请求均EOF。固定总额度96未补充；当前runtime3补验结果见下文。

- [公开接口检查结果](live-acceptance.json)、[检查器](verify-live-state.ts)：真实HTTP读取4个owner的目标及正式conversation，验证状态、累计轮次、独立控制器作者、暂停结算和原阻塞原因保留。
- [最终中文版详情](screenshots/task-complete-details-final-zh.jpg)、[中文创建](screenshots/task-create-zh.jpg)、[预算提示](screenshots/task-budget-validation-zh.jpg)、[真实暂停](screenshots/task-paused-zh.jpg)。
- [Mission冲突草稿](screenshots/mission-conflict-zh.jpg)、[阻塞原因保留](screenshots/mission-reason-retained-dark-en.jpg)、[同一目标实时语言切换](screenshots/mission-live-locale-feedback-zh.jpg)。blocked为明确记录的公开API测试前置条件，不代表模型发现外部阻塞。
- [最终桌面分栏](screenshots/sidechat-dock-final-dark-en.jpg)、[侧聊完成](screenshots/sidechat-complete-final-dark-en.jpg)、[未启动Mission引导](screenshots/mission-draft-guidance-zh.jpg)。所有视觉结论来自真实页面呈现、实际截图和人工查看；不存在UI自动化、快照或像素比较。
- [完整证据包清单](evidence-package.json)、[打包与凭据扫描工具](package-evidence.ts)：8个audit gzip档保留445个原始文件，原文件仅保留本地；日志以`.log.gz`保留原始字节。完整文本与解压归档凭据扫描通过。
- [运行清理](runtime-2/settlement.json)：7个正式服务generation退出，端口关闭，配对auth/models副本删除；浏览器临时页关闭，视口恢复。

改动前、加载中和关闭过渡截图用于调查，名称标明其状态；不可作为最终画面证据。聚焦合同测试为16个测试、43个断言，另有正式HTTP、类型、构建、本地化、CSS及文档检查。原工具误判与复跑证据完整保留，详见方案记录的最终结果。

[集成日志](integration/)记录冻结视觉基线之后合入远端和主工作区已验证提交的独立检查：Goal合同16测试/43断言、事件投递及fork合同16测试/51断言、SDK现有build、两次根目录8包typecheck及overlay正式build。原日志保留为gzip，集成检查不冒充新的页面视觉证据；详见方案的Git集成验证。

当前已推送`548660a8b`另补验[runtime-3](runtime-3/)：3个真实目标/6轮，Chat/Task/Mission各2轮，Task暂停后结算并显式恢复；[重启前](runtime-3/before-restart.json)与[冷重启后](runtime-3/after-restart.json)完整Goal投影一致，所有实际回复由[公开检查器](runtime-3/public-state.ts)关联原输入核对。持续目标后台36测试/196断言通过，额外Delivery Goal Workload的33/95不计入持续目标指标。新增14真实流式200/EOF，总计38/96，运行及配对凭据已回收。主agent独立执行，未发现新产品问题。

- [Task当前基线最终详情](runtime-3/task-complete-details-zh.jpg)、[暂停后已结算](runtime-3/task-paused-settled-zh.jpg)、[冷重启后详情](runtime-3/task-after-restart-details-zh.jpg)。
- [Chat冷重启后完整画面](runtime-3/chat-after-restart-final-zh.jpg)、[Mission冷重启后完整详情](runtime-3/mission-after-restart-final-zh.jpg)、[清理事实](runtime-3/settlement.json)。
- [Task创建检查器误判](runtime-3/seed-checker-failure.json)：HTTP202已正确接受，通过原ID恢复取证，未重复创建。
