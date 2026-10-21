# 持续目标入口与交付成果命名

对应[方案与实际结果](../../records/2026-10/2026-10-21-goal-deliverable-interface.md)。2026-10-21，单agent。Home的持续目标操作移到同一输入框后、快捷建议前；标题/创建按钮明确，移除背景与双边框，指南引用当前本地化按钮名称。Task工具/标签/环境进度称为Deliverables/交付成果，面板说明其交付/验收职责并指向会话顶部持续目标。原用户/模型标题与技术身份不改。

- [全量数据保留](data-preservation-observation.json)：两套各90表131156原行、字段/时间/rowid/主键差异0，schema3/integrity、原bytes/mtime、完整canonical相等；Project150/Session199/Provider activity321保持。
- [原真实Task身份与artifact种类](task-candidates.json)，源engine_goal实际0行；没有伪造非空列表或新增模型输入。
- [正式最终构建](build-after.log)、[首次构建](build-initial.log)、[前端类型](typecheck.log)、[两语言2525 key](i18n.log)通过。静态检查不替代视觉；没有UI自动化测试。
- [before原74015结算](before-physical-terminal.json)、[after原41534结算](after-physical-terminal.json)：公开shutdown200、原handle exit0、native物理/output/request/launcher与原出生完整。自有71/72页面已关闭。
- prepare/serve/launch/shutdown/settle/inspect/preserve/归档脚本可审查。私有原全库行JSON、DB、完整运行历史和auth/models不归档。
- [文档检查](docs-check.log)及[实际凭据值安全扫描](secret-scan.json)通过；扫描只核验安全，不输出凭据。

16张实际桌面1280×720人工截图；[保存时间](screenshots.json)不是绘制时间，没有截图基线/像素差分：

1. [01旧Home](01-before-home-en.png)、[02真实Task](02-before-task.png)、[03旧Goals空态](03-before-goals-panel-en.png)：顶端持续目标已完成，右侧却说Goals尚未生成。
2. [04新英文Home](04-after-home-en.png)、[05英文指南](05-after-guide-en.png)、[06原创建表单及草稿](06-after-create-draft-en.png)、[07取消后草稿保留](07-after-cancel-draft-en.png)。
3. [08英文交付面板](08-after-deliverables-en.png)、[09目录菜单](09-after-task-tools-en.png)、[10目录Add tool对应的工具选择](10-after-directory-tool-picker-en.png)。
4. [11中文交付面板](11-after-deliverables-zh.png)；[12误把恢复的Task当Home](12-after-home-zh.png)是验收导航未到目标，不计作Home通过。
5. [13由新对话进入中文全局Home](13-after-global-home-zh.png)（有导航tooltip）、[14中文指南](14-after-guide-zh.png)、[15中文全局创建表单](15-after-create-global-zh.png)、[16取消后最终清晰Home](16-after-cancel-global-zh.png)。仅打开/关闭表单，没有确认创建或发送。

非空交付列表/环境进度行无真实数据，旧交付编辑入口不可达性尚待核查，这些视觉场景未达成。没有据局部UI通过声明整个产品或长期Goal完成。
