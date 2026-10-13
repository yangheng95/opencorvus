# Explorer 批量文件操作证据

对应[根因、方案及验收记录](../../records/2026-10/2026-10-13-explorer-copy-convergence.md)。所有项目与文件由本次调查新建；不修改用户项目，不注入消息、不新增模型调用，不运行UI自动化。

- `before/01-partial-copy.png`：真实 Ctrl 多选 source 两项复制到 target；后项冲突后，成功目标缺失于搜索、源选择未收敛。
- `before/02-root-copy-rejected.png`、`03-root-move-rejected.png`：真实目录目标 `.` 被错误拒绝。`00-home.png` 是进入文件工作台前的主页。
- `before/before02-physical-files.json`：关闭前态服务后读取的完整源/成功目标/冲突目标内容；与真实页面前态对应。
- `before/before02-created-empty-chat.json`：正常公开会话创建接口的空会话回执，无虚构参与者或消息。
- 各 `*-inputs.json`、`*-launch-owner.json`、`*-ui-binding.json`：明确文件输入、实际 Native Host/Target 实例、固定物理上限和私有 bin/ui 入口。
- 各 `*-physical-terminal-and-pair-cleanup.json` 与 `*-launcher-joined.json`：正常shutdown、实例退出、输出与请求收尾。本批从未复制 auth.json 或 models.json。
- 首个 `before` 实例存在运行器 Port 被 FunctionsOnly 参数覆盖成0的失败；原startup绑定7878，恢复shutdown200，但Host输出收尾failed。`before-recovery` 原失败保留，不能作为合格运行。完整新发生实例 `before02` 正常结束。

- `after/01-partial-copy-converged.png`：成功目标、正确选择与原冲突同时可见。
- `after/02-root-copy-success.png`：项目根`.`复制完成，源和目标四项准确。
- `after/03-root-move-success-zh.png`、`04-root-moved-file-zh.png`：中文根移动成功及实际打开的正确文件。
- `after/after-physical-and-live-api.json`：10文件完整预期字节与同一生产服务读取，三项source根400合同。
- `root-contract/`：原28案例根调查、首次测试失败、最终18项294断言与8项Git57断言通过，类型/格式验证；额外父worktree回执500的原始数据保留。
- `validation/`：146项前端路径/service288断言、类型、私有正式build、文档检查日志；无UI自动化测试。
- `runtime/`：原始startup、实际Host ready/settled/error和完整stdout/stderr；失败实例不会被成功实例替换。
- `reviewed-scripts/`：原scratch运行与收尾脚本快照，包含当时绝对scratch依赖；不是可从artifact目录直接运行的通用工具。

日志按原字节gzip保存，解压后逐字节核对归档保真，保留初次失败；不以摘要或校验和替代功能验收。POSIX、真实I/O故障和双失败错误合并未验；已确认的父worktree metadata问题及旧提示语言投影留待下一批。
