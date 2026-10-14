# 0.1.26 整合与发布证据

方案与 Recall：[发布记录](../../records/2026-10/2026-10-14-release-0.1.26.md)。所有日志是本轮真实命令输出，gzip 仅用于保存完整原件，不代表语义测试通过。保留初次失败、错误选择路径和定位时的断言错误，不覆盖为后续成功。

- `integration-tests.log.gz`：整合首轮，包括旧 dispatch 工具预期、orphan 权限结果及误写的不存在路径。
- `legacy-retest.log.gz`：改成真实权限执行后的定位运行；历史事件需按 request_id 而不是只在 requested 行出现的 tool_call_id 关联，本次定位断言仍失败。
- `integration-retest.log.gz`：六个实际后端文件的完整复验，以末尾各文件 exit 和 pass/fail 为准。
- `contract-tests.log.gz`：版本、发布身份/期限/派发、工作流与双语日志等局部契约检查，83 项通过；不冒充原生发布端到端结果。
- `frozen-install.log.gz`：冻结依赖安装的实际输出。
- `generate.log.gz`：唯一生成器刷新专家团 revision registry，源码已是 2026.10.14.1。
- `worktree-inventory.json`：普通合并后的全部 Git 工作树、原 HEAD、ancestry 和各工作树真实 status；主目录当时包含本轮待提交版本准备。
- `fixed-point.log.gz`：已提交 a73080f68 的第二次完整生成，exit0、tracked diff 为空；原缓存保持。
- `push.log.gz`：完整正常 pre-push 与首次 push 回执，origin/main 到 a73080f68，扫描 0 hits；GitHub 原 Rust 告警保留。
- `release-admission.json`：canonical run38546102976 的实际 source、created_at 和 prepare 成功；矩阵当时仍运行，不能当发布完成回执。

正式 workflow/source、GitHub/更新通道/官网公开回执在发布完成后追加。版本资源的真实签名和资产完整性继续由 canonical workflow 检查，不用可变源码摘要替代行为验收。
