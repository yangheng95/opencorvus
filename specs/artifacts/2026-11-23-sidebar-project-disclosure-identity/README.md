# 侧栏项目展开关联的桌面证据

Windows 桌面专用标签，基线开发服务 40560，构建 `main-DTMBeKuP.js`。三个项目和会话为独立测试数据。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-distinct-projects-both-expanded.jpg) | 英文侧栏同时显示三个项目及各自会话。 |
| [02](02-baseline-en-research-collapse.jpg) | 回车仅折叠研发，焦点留在该项目展开按钮。测试继续显示自己的会话。 |
| [03](03-baseline-zh-distinct-projects-both-expanded.jpg) | 简中侧栏同时展开独立目录和原会话。 |

截图用于核对实际侧栏和操作。只读页面记录补充每个可见按钮的展开值、标识匹配数、自己包含的文本及关联实际解析的文本。英文与简中均观察到研发关联落入测试的正文。 [英文基线关联](baseline-relations.json) · [简中基线关联](baseline-zh-relations.json)

候选开发服务 40562，构建 `main-BFL1gus-.js`。

| 截图 | 人工核对 |
| --- | --- |
| [04](04-candidate-en-distinct-projects-both-expanded.jpg) | 英文同时展开三个项目，各显示自己的已有会话。 |
| [05](05-candidate-en-keyboard-collapses-only-research.jpg) | 回车仅折叠研发，测试会话和原首页留在可见位置。 |
| [06](06-candidate-zh-distinct-projects-both-expanded.jpg) | 简中保留同一分组内容及原始会话标题。 |
| [07](07-candidate-zh-project-name-opens-research.jpg) | 项目名称打开研发首页，与展开按钮的职责独立。 |
| [08](08-candidate-zh-keyboard-collapse-preserves-active-project.jpg) | 空格从测试按钮折叠测试，研发首页和研发组仍可见。 |
| [09](09-candidate-zh-pinned-research-keeps-own-content.jpg) | 研发迁入置顶区保留原会话，测试留在项目区。 |
| [10](10-candidate-zh-pinned-opens-exact-work.jpg) | 从置顶研发组打开 Cedar research notes，会话头部和显示位置一致。 |
| [11](11-candidate-zh-unpin-keeps-open-work.jpg) | 取消置顶后，研发返回项目区，已打开会话及研发名称焦点保留。 |

英文和简中候选的展开按钮，每个关系都唯一解析到当前项目自身会话。键盘循环复用仍挂载的组标识。置顶和取消置顶时，重新挂载的研发组使用新标识。 [英文初始关联](candidate-en-relations.json) · [英文键盘操作关联](candidate-en-keyboard-cycle.json) · [简中和置顶关联](candidate-zh-relations.json)

[规格和验收](../../records/2026-11/2026-11-23-sidebar-project-disclosure-identity.md)
