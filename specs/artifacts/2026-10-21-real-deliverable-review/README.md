# 真实交付体验与 Task 取消审批收敛

2026-10-21，单 agent；[Recall、调查与实施方案](../../records/2026-10/2026-10-21-real-deliverable-review.md)。本批为持续迭代中的进展，不是整个产品或长期 Goal 完成。

## 真实发现与修复

原真实 Sol Task 只建立第一份交付合同，第二份合同尚待批准时，操作者明确取消本次有限验收。Task 已 cancelled，但原权限账本仅 requested，仍自动弹出批准对话框：[原图03](03-cancelled-incomplete-task.png)、[持久事实](cancelled-durable-facts.json)。修复 Task 取消时缺少账本取消决定的根因，并让服务启动、项目恢复和取消重放收敛旧残留。原操作原因和系统身份进入现有 cancelled 决议，Terminated 仍由现有 outbox 发布；没有前端隐藏规则、schema（结构）迁移或额外工作流。

启动恢复只用现有 Project identity（项目身份），不要求 Provider（模型服务）初始化。历史收敛在确认当前取消的事务中捕获精确请求身份，任务重新开启后的新轮次仍能正常批准。Task/Mission 子 Task 入口共用取消器；普通 Session、Mission 自身 occurrence（执行轮次）及进程中断的恢复边界没有被改成全会话权限清空，相关独立审批体验仍需后续实测。

## 验收与真实限制

- [22 项后端检查、331 项断言](focused-tests-final.log)：67 个跨页请求及后代、并发取消、迟到批准的真实 deny 赢家、历史启动发现、兄弟和跨项目正常批准、重新开启 epoch（执行轮次版本）2、SQLite（嵌入式数据库）取消写入故障后的生产重试。均通过正式隔离运行器，无界面自动化。另有 [typecheck（类型检查）](typecheck-final.log)。
- 新 [启动恢复服务](recovery-final-native-host-settled.json) 实际输出 cancelled_permission_tasks_recovered=1，attempted/initialized/mission 均 0，failures=0。真实 Board（任务看板）200，原 pending 成为 rejected/deny，账本精确 requested→cancelled。[HTTP（超文本传输协议）观察](recovery-final-observation-summary.json) 保留凭据缺失时回复和取消重放的真实 ProviderModelNotFoundError 400；不能宣称这两个 HTTP 操作已完成正常模型配置下的端到端验收。核心迟到决议和重放有真实后端正向合同验证。
- 7 张实际截图均已人工查看。修复后 [任务页面](04-recovered-cancelled-task.png) 无旧自动审批弹窗；真实非空交付的 [英文展开详情](05-real-deliverable-expanded-en.png)、[中文详情](06-real-deliverable-expanded-zh.png) 和 [环境进度](07-real-deliverable-environment-zh.png) 保留 #G1、0/1 和“尚未验收”事实。04 有临时鼠标提示，05–07 为清晰详情。没有伪造第二份合同、文件或验收通过；系统取消在当前界面仍按通用“拒绝”标签呈现，这一措辞问题未在本批修复。
- 原 Task 请求额度 12，实际 9 次均 gpt-6.1-sol、stream=true、HTTP200、原 source reader（流读取者）EOF（读取结束）。其中 4 次为既有 memory helper（记忆辅助调用）。[审计摘要和容量槽位事实](actual-provider-and-capacity-summary.json)；12 不足覆盖全部原 ask 审批和文件链，独立 24 次复测尚未启动，原两文件交付验收未达。初次 Task model 输入格式400、首个恢复脚本字段预期错误和第一次缺少启动发现均保留原响应，没有重写成功。
- 原 before 全量复制 90 表131156行，真实追加后132827行。只有两条可变容量池槽被实际获取/释放，原30秒租约到期前的 release 事实与代码一致；未回写旧租约伪装0差异。两个恢复复制各保留90表132827原行的全部字段/rowid（行身份）/主键，原行差异均0，Provider activity（调用活动）326→326。原源 bytes（字节）/mtime（修改时间）、完整 canonical（规范配置）和 schema3/integrity（完整性）保持；私有全库历史未归档。
- before 原61410、第一恢复10773、最终恢复32950均公开 shutdown200，原 handle（进程句柄）exit0、native（原生）physical/output/request/launcher 与原出生终态完整。对应三个 physical-terminal 文件保留。两套恢复没有凭据与模型输入；第一套 Sol 的 runtime 和源私有 auth/models 配对均已退休，原用户凭据/目录保持，[退休证据](authority-retirement.json)。原 IAB（内置浏览器）73、74页已关闭，用户进程和窗口未重启。

## 复核与后续

只读原脚本、逐请求元数据、精确 HTTP 回执、完整保留比较、截图与原进程结算可在本目录核对。真实 auth/models、原历史快照与完整运行日志不进入仓库；归档后另做实际凭据值扫描及正式 Git hook（钩子）检查。下一轮继续正常模型配置下的迟到回复/取消重放与独立两文件 Task 交付，不把受控回调或静态代码当作端到端通过。
