# 构建数据库边界证据

[方案与Recall](../../records/2026-10/2026-10-14-build-database-boundary.md)。本轮为构建及数据库路径审计，无UI改动或UI自动化验收。归档仅含诊断脚本、日志、结构/文件事实和自有样本标记，不含数据库文件、用户消息或Provider凭据。

- `facts/review-result.json.gz`：最终正向复核，默认用户库与样本库保持版本1、实际对象和行计数/文件身份/大小/修改时间保持，样本原项目及cache标记保留；另一自有副本真实启动迁移到2，版本1备份保留完整原行。
- `facts/inventory-before.json.gz`、`facts/inventory-after.json.gz`：前后只读SQLite实际事实；`checks/imports-before.log.gz`、`checks/trace-before.jsonl.gz`：修复前仅导入生成器即把样本用户cache从0改为21。
- `checks/full-build.log.gz`、`facts/full-build-result.json.gz`、`checks/trace-full.jsonl.gz`：原命令`bun run build:overlay`真实完整构建退出0、物理/输出收尾完成；OpenAPI运行目录独立，迁移checker使用内存SQLite，产物first-run使用另一自有临时目录且realProvider=false。
- `facts/owned-build-teardown.json.gz`：构建产出后显式收尾本次自有全树请求的精确owner/helper/target实例；不能把主动验证清理称为自然退出。`checks/full-build-actual-owned-tree.ts.gz`是实际执行runner，`checks/full-build.ts.gz`是之后改用现有前台生命周期primitive的有限命令runner，后者未重复全链构建。
- `checks/contract-after.log.gz`：3项/17断言；`checks/permission-migration.log.gz`：10项/39断言；`checks/foreground-process-facade.log.gz`：2项/6断言，包含真实子树与并行peer收尾。均为后端/构建合同。
- `checks/typecheck.log.gz`：8个package；`checks/docs-check.log.gz`、`checks/architecture-check.log.gz`：当前文档与架构检查；`checks/root-generate.log.gz`、`facts/root-generate-result.json.gz`：真实独立生成命令退出0、生成产物保持当前内容。
- 带`failure`、`invalid-observation`、`help-only`的日志和回执保留验收工具失败，分别对应参数误解析、编译静默窗口过短、自有preload破坏shebang；不得将其当作产品通过或隐去。`review.log.gz`为最终成功重跑结果；此前过早读取尚未产生的构建回执出现ENOENT，原临时日志已被成功结果覆盖，此错误记录在方案中。

版本2的SQL对象与版本1相同（内存实际对象517项）；追加迁移只补历史权限decision索引审计数据。代码历史与用户追问结论见方案，不重写已交付迁移。
