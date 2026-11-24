# Git 说明生成失败时保留手写正文

## Recall

用户要求本人独立持续按批次迭代，在真实复现后先落盘分析与影响，之后实现、实际桌面和截图复核、聚焦正向测试、范围提交和上游正常推送。上批 `d7c7518c2` 已核对到 `origin/main`，0/0，177 项无关状态保留。本批在临时无远端 Git 项目中执行，服务使用全新隔离目录与未配置模型的空白聊天。

已读[Git 提交草稿的独立结算](2026-11-25-git-commit-retains-newer-message-draft.md)、[Git 分支确认](2026-11-24-git-action-confirmed-branch.md)与[界面架构](../../current/architecture/07-panel.md)。全仓追溯 `generateCommitMessage`、`disposeCommitMessageStream`、`commitMessageGenerating`、`VcsCommitMessageError`、`VcsCommitMessageStreamEvent`、`vcs.commitMessage.stream`、真实流的 `delta/done/error`、Git 动作诊断及英文/简体中文文案。核对当前模型辅助功能与原 Git 动作使用相同弹窗，各自有独立服务回执。

## 实施前证据、根因和影响

- `41972/ui/` 运行 `main-BNoDWdwH.js`。一个已跟踪文件有真实修改。打开提交框，第一次流 `ddb36006-9912-4fac-a1a4-a25e75610fe7` 返回 HTTP 200，界面展示尚未配置可用模型。手写 `Keep this hand-written subject if generation fails` 后，提交可用，上一条生成提示仍可见。点击原“Regenerate commit message”，`fb92dbda-a56a-40e4-80ab-54f807f587e6` 在 UTC（协调世界时） `16:33:52.220` 返回 200，界面提示生成条件不足，原说明消失，提交按钮停用。原路由的另外一次实际流 `cae6a75e-6a8c-455e-94c2-e8be9aa217e2` 返回正式 `error/model_not_configured` 事件。Git 磁盘样本仍为 `M notes/checklist.txt`。[基线截图](../../artifacts/2026-11-25-git-regeneration-retains-authored-subject/README.md)
- 根因是生成开始立即清空提交说明信号，收到 `delta` 也直接覆盖原输入。当前可靠完成的 `done` 与终止的 `error` 共用已接受说明这个事实字段，失败或关闭时只结束忙碌，无正文可以恢复。生成失败和 Git 写入失败都写同一个错误字段，使手写说明后仍显示上一条生成提示。原 Git 写回执的提交说明代次只覆盖真实提交，重新生成属于不同的临时写入所有者。
- 影响为已有说明后显式重新生成时的错误、流退休或关闭，及空白输入初次进入时的说明提示。保留真实流的消息次序与界面呈现、错误来源、项目及分支所有权、普通手写提交、已接受的 Git 写回执、模型配置行为、公开接口和持久化。无 Task（任务）、Mission（多步任务）、Session（会话）执行轮次的调度、队列、唤醒或终态异常。此轮验证未配置模型的真实失败，已授权模型实际生成成功未纳入本轮输入。

## 实施前方案与验收

- 提交说明仍由既有可编辑信号所有。当前流的未确认文本只作为输入预览，逐段真实呈现，在流活动期间沿既有规则暂停写入。只有同一当前权威流的成功 `done` 替换正文；失败、关闭及范围退休结束预览，保留先前正文和交互。生成失败有自己的提示，用户手写后退休该提示，Git 写操作的诊断仍由原操作所有。
- 真实桌面重走未配模型的首次生成、手写、重新生成和继续提交，确认手写原字在失败后保留，控件和焦点可继续使用，写入 Git 的主题与文件符合实际输入。检查流与 Git 原有正向契约、双语、类型、构建和项目文档。真实局部验收与模型测试夹具各自标明覆盖范围。
