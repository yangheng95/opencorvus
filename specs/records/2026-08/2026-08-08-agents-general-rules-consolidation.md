# AGENTS.md 通用规则精简方案

## Recall

- 用户原始要求：精简仓库根目录 `AGENTS.md`；随后明确要求删除具体 case 相关的规则。
- 验收指标：全局规则只保留跨任务复用的约束；删除事故、页面、子系统、工具调用和发布链路等具体 case 手册；消除重复与历史编号依赖；不改变本任务之外的工作区文件；完成文档验证并留下可审查的 Git 提交。
- 硬约束：保留根因修复、单一来源、禁止 fallback、流式大语言模型交互、自然消息流、非用户界面正向测试、真实用户界面截图人工验收、方案落盘、Git 安全与不主动推送等项目级原则；不新增或运行用户界面自动化测试；使用 `apply_patch` 修改文件。
- 已读取资料：根目录 `AGENTS.md` 全文及标题索引、`specs/README.md`、`specs/records/README.md`、`specs/records/2026-08/README.md`、`specs/current/architecture/99-principles.md` 标题索引、根 `package.json` 文档脚本。
- 全仓 grep 结果：除 `AGENTS.md` 外，源码注释仅零散引用 rule 6.1、10、35、36；产品文档只把 `AGENTS.md` 描述为通用 agent 指令入口。具体规则编号不是运行时协议，因此本次取消编号不会改变产品契约；相关源码注释后续应依靠其本地语义，而不是让全局规则保留历史编号。
- 独立 agent 反馈：无。用户未要求多 agent 审计，本任务也不需要并行委托。

## 精简边界

保留并合并为七组通用规则：

1. 执行与证据；
2. 架构与实现；
3. 测试与验收；
4. 用户界面交付；
5. 文档与术语；
6. Git 与工作区安全；
7. 环境与交付。

直接删除以下 case 内容，不在全局规则中改写或另建兼容条目：

- dispatcher 缺失 XML 的事故规则；
- 专家团安装、投影、Mirror Watch、MirrorTest 与 workflow 的完整子系统契约；
- SQLite 指纹、WAL/SHM 备份等迁移实现手册；
- orchestrator 消息卡片、mock 网页验收等具体事故条款；
- Claude Code CLI 参数手册；
- Host/WSL 同步命令和 remote baseline 上传流程；
- OpenCorvus/overlay 进程事故、停止前删除、project_id 404 术语事故；
- Mirror/OpenMirror 同名触发事故；
- 截图参考线、标题图标槽、hover 状态等单次用户界面 case。

上述仍有效的产品架构事实由 `specs/current/architecture/**`、对应 package 文档、脚本帮助和源码契约负责，不再重复塞入 `AGENTS.md`。

## 实施与验证

1. 将 `AGENTS.md` 重写为短小、无编号、可独立执行的通用规则集。
2. 检查删减前后字节数、标题结构、敏感 case 关键词与 Markdown 格式。
3. 运行仓库当前声明的 `docs:check`。旧规范列出的三份文档测试已不存在，Bun 无法进入测试器，因此不重建过期检查器。
4. 审查仅本任务文件的 diff，创建独立 Git 提交，不推送。
