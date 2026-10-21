# 真实文件交付、变更观察与只读预览

对应[实施前 Recall、根因及验收记录](../../records/2026-10/2026-10-21-deliverable-completion-review.md)。单 agent，版本未变，数据库 schema 3 未变；没有启动独立 Vite、运行 UI 自动化或委派产品 Worker。

## 实际结果

- 原 501 已取消 Task 在正常成对凭据下公开迟到回复 HTTP 200，结果仍为 rejected/deny；取消重放 202，原 epoch、取消事件和权限账本保持。[原始请求响应](before/cancelled-replay-http.json)、[摘要](before/cancelled-replay-summary.json)。补齐上一批无凭据 400 的验收缺口，不改写原失败。
- 首轮真实 Task `tsk_g00VYea3v400L1Mk9kkG` 自然 completed，独立写出两文件、真实发布快照、回读并接受两项交付合同；19/24 次实际 gpt-6.1-sol 请求，全流式 200、原读取者 EOF。[完整本任务事实](before/completion-facts.json)。已声明的 llm_judge 标准不代表另行执行过独立评审模型。
- 首轮完成后页脚却显示修改信息不可用。[真实失败截图](before/06-completed-task-change-data-unavailable.png)、[规范原 Tool Part](before/actual-completed-patch-part.json)、[数据根因](before/issue-source-analysis.json)。10882 字节结果进入延后读取时，1024 字节元数据投影丢失文件事实。
- 修复后同一原历史无需迁移即显示两文件、+27/-0，Review 读回两份原始端点。[历史摘要](after/01-historical-file-observations.png)、[第一份](after/02-historical-goal-review.png)、[第二份](after/03-historical-deliverables-review.png)。这两张 Review 也保留了默认 380px 横分拥挤的真实失败现象。
- 新独立 Task `tsk_g00VYejR5b00qdJmPgrC` 以同一原请求自然 completed，真实两文件各 11 行，合同 2/2 接受、已发布；21/24 次实际 Sol 请求，全流式 200/原读取者 EOF。[真实完成事实](after/completion-facts.json)、[+22/-0 摘要](after/06-natural-completion-file-summary.png)。6 次单次批准含模型自行读取的内置交付方法，未使用 Task-wide 或 Full access。
- 新快照审批资源展示真实 files 参数。[实际审批图](after/05-snapshot-exact-files-approval.png)。截图滚动窗口只完整显示第一条路径，原始两个 files 以 completion-facts 中不可变权限请求为准；没有把旧历史空 scope 重写成新 scope。
- 默认窄 Review 改为上方文件、下方全宽差异，原换行与键盘激活正常；宽 Review 保留双栏。[英文窄栏](visual/01-final-narrow-review-en.png)、[第二份](visual/02-final-second-file-narrow-en.png)、[宽栏](visual/03-final-wide-review-en.png)、[中文窄栏](visual/04-final-narrow-review-zh.png)、[完整最终版本](final/04-final-review-restored-en.png)。
- 真实 Sources 能进入原文件编辑器，2/2 合同可展开具体目标和验收。[Sources](visual/06-real-source-file-editor-zh.png)、[环境交付](visual/07-accepted-deliverables-zh.png)、[合同详情](visual/08-accepted-contract-details-zh.png)。
- 零凭据只读服务暴露发布预览被执行模型初始化 400 拦截。[真实失败](visual/09-published-markdown-preview-zh.png)、[实际请求日志](visual/actual-artifact-read-log.json)。冷启动正向 HTTP 测试先复现 400，再修复唯一项目路由能力分类；完整相关 15 项通过。最终独立零凭据服务读取同一原发布资源 200，[请求日志](final/actual-artifact-read-log.json)、[真实预览](final/02-published-preview-restored-en.png)、[全文产物工作区](final/03-published-workspace-restored-en.png)。界面模型配置提示如实保留，阅读恢复不冒充模型可执行。

30 张截图全部实际呈现并人工查看。before/04 是快照输入，空 scope 另由账本证明；before/05 有审批遮挡，before/06 才能清楚看到源文件。visual/05 保留选错旧索引的观察，visual/06 才是正确 Sources 结果。final/01 是未打开预览的初始视窗，final/02–03 才证明恢复。失败与中间图没有删掉或算成成功。

## 检查与安全边界

[首组检查](checks/tests-validation.log)共 27 项/71 断言；[冷启动修复后](checks/artifact-cold-after.log)15 项/77 断言，总 42 项/148 断言。保留[修复前原 400](checks/artifact-cold-before.log)。前后端类型检查、最终正式前端构建/公共渲染面、2525 项双语键、CSS token 和六项接口路由规则检查见 checks/。构建仍有既有大分块提醒，未升级版本或发布安装包。

首轮完整复制90表132832原行，复测源136185行，两个零凭据视觉源各140168行。四次全表/rowid或主键/全部字段、完整规范配置、源数据库字节/mtime、真实 schema/integrity 观察位于各目录 data-preservation-observation.json；前两轮仅现有容量池两槽真实租用/释放字段变化，不能称为全字段零变化。两个零模型视觉副本所有原行字段均保持，Provider activity 351→351。没有向源副本或真实用户数据库写回。

四次服务均公开 shutdown 200，原 exec、native 精确出生、物理进程、输出、请求和 launcher 完整结算；两个 Provider scope 的运行时及新源 auth/models 四对成员已退休。终态证明位于各目录 physical-terminal*.json 和 public-shutdown.json。首轮退休脚本误保留 501 的未完成叙述，原始文件保留，以 before/retirement-status-correction.json 和真实 completed 事实校正。

归档前实际凭据值扫描 68 文件/3317520 字节零命中；auth/models、原完整历史行、原私人日志均排除，仅归档本次 QA Task、统计观察、实际回执及截图。当前分支依仓库规范正常提交、fetch/merge、检查全部待推送集合及 hook 后推送。持续总 Goal 保持 active；本轮不以单 orchestrator 的完成页替代原成员实时 Rendering 或149目录完整配置性能验收。
