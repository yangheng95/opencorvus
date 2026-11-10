# MCP 管理显示实际目标项目的桌面证据

对应 [根因、方案与验收](../../records/2026-11/2026-11-10-mcp-active-project-context.md)。两份隔离项目均名为 `Workspace`，实际目录分别是 `alpha/Workspace` 与 `beta/Workspace`，各有一个不同的禁用配置。图片来自真实开发模式 `/ui` 1280×720 桌面页面，经手工操作后逐张查看。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 基线 | [英文 alpha](baseline-en-alpha-no-project-identity.jpg)、[英文 beta](baseline-en-beta-no-project-identity.jpg)、[中文 beta](baseline-zh-beta-no-project-identity.jpg) | 管理页只描述当前项目，标题和操作不能区分两个目标。 |
| 基线侧栏 | [两个同名项目](baseline-zh-sidebar-distinguishes-projects.jpg) | 可见真实 `alpha`、`beta` 目录线索，但打开设置就不再可见。 |
| 首版视觉调整 | [英文 alpha](draft-en-alpha-faint-scope.jpg) | 项目名和父路径能辨认，但对比与层次不够清楚；最终加强项目名和短路径。 |
| 最终英文 | [alpha](candidate-en-alpha-project-scope.jpg)、[beta](candidate-en-beta-project-scope.jpg) | 在管理操作旁可见当前项目和父路径，列表是该目录的禁用定义。 |
| 最终中文 | [beta](candidate-zh-beta-project-scope.jpg)、[切回 alpha](candidate-zh-alpha-project-scope.jpg) | 两个同名项目可以辨认；项目与状态共同更新。 |
| 分配导航 | [beta 通用工作](candidate-en-beta-assignment-navigation.jpg) | 原有入口仍定位到同一项目的真实未分配连接。 |
| 其他入口 | [技能库](candidate-zh-skill-library-read.jpg)、[无项目](candidate-zh-directory-free-guidance.jpg) | 共享管理页仍读出实际技能；无项目时展示工作区选择提示。 |

完整路径通过原有展开控件手工核对；包含本机账户路径的展开原图只留在隔离验收目录。已提交截图只包含测试项目的短目录上下文。

[公开读取回执](receipts.json) 记录两个项目的真实请求身份、精确目录匹配与禁用状态；没有原始完整目录或凭据。
