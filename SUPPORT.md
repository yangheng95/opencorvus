# Support

OpenCorvus is a community-maintained open-source project.

Before requesting help:

1. Read the [quickstart](https://opencorvus.com/start/quickstart/) and [troubleshooting guide](https://opencorvus.com/troubleshooting/).
2. Search existing [issues](https://github.com/yangheng95/opencorvus/issues).
3. Confirm the exact OpenCorvus version, operating system, architecture, and installation method.

Use the [usage question form](https://github.com/yangheng95/opencorvus/issues/new/choose) for reproducible configuration and usage questions. Use the bug form when the documented behavior is reproducibly incorrect.

Never post API keys, access tokens, private prompts, proprietary source code, personal data, or unredacted logs. Security vulnerabilities must follow [SECURITY.md](./SECURITY.md).

Support is provided on a best-effort basis. Opening an issue does not guarantee a response time or acceptance of a requested feature.

## After an upgrade: database startup is refused

New databases now begin at schema version 1. Later versions automatically apply declared upgrades before opening, with a database backup under `data/migration-backups` and a transaction that rolls back failed changes. `SCHEMA_BASELINE_REQUIRED` identifies an unversioned database from before this baseline; it requires explicitly chosen maintenance. `SCHEMA_VERSION_AHEAD` requires a newer application. `SCHEMA_MIGRATION_REQUIRED`, `SCHEMA_MIGRATION_FAILED`, `DATA_MIGRATION_REQUIRED` and `DATA_INTEGRITY_ERROR` identify an undeclared transition, failed upgrade or invalid stored facts. These errors preserve the data; do not reset a versioned database to resolve a routine upgrade.

1. Record the previous and current versions, exact error code, operation and database path. From a terminal with the **same runtime environment** as the affected application, `opencorvus db path` prints the selected database path. A differently configured terminal may select another runtime; compare it with the error path before taking action. Remove private path components from a public report.
2. Preserve the original state before attempting recovery. Stop every OpenCorvus process using that runtime through its normal shutdown flow before copying its files. Preserve the complete runtime root, including any SQLite write-ahead log (`-wal`) and shared-memory (`-shm`) files that remain, plus the affected project directories, their `.opencorvus` runtime files and any work or deliverables stored elsewhere. Keep the copies private: runtime configuration and data may contain credentials and conversations. A copy of only `opencorvus.db` is not a complete project backup.
3. Choose the outcome you need. If you need the old history, retain the original and seek help with a redacted report; a backup does not convert it to the new contract, and restoration compatibility has to be checked. If you only need to try the new version, use a new empty absolute `OPENCORVUS_HOME` and a disposable project containing only the source inputs you intend to test, such as the [first-result sample](./examples/README.md). Do not copy old `.opencorvus/.r` state into it. This starts separate state; it does not recover old tasks, settings or credentials. Configure the model through the normal setup flow.

The database is shared by projects in the same runtime root. Changing the project directory or server port does not select a fresh database. The `db reset` command is destructive: it removes that runtime's database and its sidecars, and also removes runtime scratch for the project from which it is invoked. That scratch can contain worktrees and snapshots. It is not a history-preserving upgrade procedure. Review the exact target paths and data-loss scope before explicitly choosing any reset; do not use one as a first troubleshooting step.

For help, report the versions, error code/operation, installation method and whether preserving history is required. Do not upload the database, runtime directory, credentials or raw conversations to a public issue. Maintainers can consult the [current data contract](./specs/current/architecture/02-data.md). A successful startup with a fresh runtime does not prove that the old data is recoverable.

## 升级后数据库无法启动

新数据库从 schema 版本1建立基线，后续版本在打开前自动执行已声明的迁移：先备份到 `data/migration-backups`，再在事务中升级，失败回滚。`SCHEMA_BASELINE_REQUIRED` 表示尚未登记版本的基线之前旧库，需要明确选择首次维护方式；`SCHEMA_VERSION_AHEAD` 表示需要更新的应用。`SCHEMA_MIGRATION_REQUIRED`、`SCHEMA_MIGRATION_FAILED`、`DATA_MIGRATION_REQUIRED` 和 `DATA_INTEGRITY_ERROR` 分别说明未声明转换、升级失败或已有事实不满足契约。错误会保留数据，不应通过清空版本化数据库解决正常升级。

1. 记录升级前后的版本、准确错误码、操作名称及数据库路径。在与受影响应用使用**相同运行环境**的终端中，`opencorvus db path` 会打印所选数据库路径。终端配置不同可能指向另一个运行目录；采取操作前先与错误中的路径核对。公开报告中请隐去私人路径信息。
2. 恢复前先保留原始状态。通过正常退出流程停止所有使用该运行目录的 OpenCorvus 进程，再复制文件。保留完整运行根目录，包括仍存在的 SQLite 预写日志（`-wal`）和共享内存文件（`-shm`）；同时保留相关项目目录、其中的 `.opencorvus` 运行文件，以及存放在其他位置的工作文件和交付物。备份应私密保存，配置和数据可能含有凭据与对话。只复制 `opencorvus.db` 不构成完整项目备份。
3. 根据需要选择后续方式。如果需要历史记录，请保留原件并提供脱敏报告寻求协助；备份不会将数据转换为新契约，恢复兼容性仍需核验。如果只想体验新版本，请使用新的空目录作为绝对路径 `OPENCORVUS_HOME`，并使用只含待测试源码输入的临时项目，例如[首次使用样例](./examples/README.md)。不要将旧的 `.opencorvus/.r` 运行状态复制进去。这会建立独立状态，不会恢复旧任务、设置或凭据；模型应通过正常配置流程重新设置。

同一运行根目录下的项目共用数据库。更换项目目录或服务端口不会切换到新数据库。`db reset` 是破坏性操作：它会删除该运行目录的数据库及其附属文件，还会删除执行命令所在项目的运行临时数据，其中可能有工作树和快照。它不是保留历史的升级流程。明确选择任何重置前，应先核对准确目标路径和数据丢失范围，不要将重置作为第一步排查。

寻求帮助时，请提供版本、错误码／操作名称、安装方式，以及是否必须保留历史。不要把数据库、运行目录、凭据或原始对话上传到公开 issue。维护者可查阅[当前数据契约](./specs/current/architecture/02-data.md)。新运行目录能够启动，不代表旧数据已经可以恢复。
