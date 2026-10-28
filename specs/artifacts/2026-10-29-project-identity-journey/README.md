# 项目名称与首页作用域

对应[调查与实施记录](../../records/2026-10/2026-10-29-project-identity-journey.md)。单代理、真实开发服务器 `/ui` 与16张原始JPEG人工复核；无UI自动化测试、文案/DOM断言或像素基线。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-project-home-before.jpg)、[02](02-project-rename-dialog.jpg) | 原首页与真实重命名对话框，只改显示名，不改目录。 |
| [03](03-project-rename-result.jpg)、[04](04-project-rename-settled.jpg) | 原重命名实际400、名称未写入，模型初始化先行失败。 |
| [05](05-project-pin-current.jpg) | 原实例实际置顶成功。 |
| [06](06-rename-backend-repaired.jpg)、[07](07-project-unpin.jpg) | 后端修复后改名200/9ms、解除置顶成功；06完整1280图证实侧栏已改名但首页仍project。 |
| [08](08-home-name-restored.jpg)、[09](09-home-live-rename.jpg) | 最终构建重开保留中文名，再实际改英文名200/8ms，侧栏与首页同步。 |
| [10](10-close-project.jpg)、[13](13-project-reopened.jpg) | 可逆Close project回无目录首页；侧栏记录仍在，点击原项目重新选中后使用同一显示名。 |
| [11](11-project-search.jpg)、[12](12-project-search-settled.jpg) | 当前搜索合同为Chats/work/commands；Project行没有候选，不能宣称按项目名搜索重开成功。 |
| [14](14-chinese-home.jpg)、[15](15-final-home-english.jpg)、[16](16-final-home-focused.jpg) | 中文界面保留英文项目原名，恢复英文、输入区空白与原焦点。 |

部分工具原图宽1119，而该文档布局宽1280；按实际捕获范围审阅名称/导航区域，不能凭捕获边缘推断产品CSS溢出。未裁图、重绘或改全局窗口，用户18571及原窗口未操作。

[requests.json](requests.json) 为实际请求完成日志；[data.json](data.json) 逐阶段92表/103484行、schema9/integrity ok，只有选中QA Project的name/time_updated/time_pinned按真实操作变化。原始基线改名失败后仅pin变化，后端阶段改名并unpin，最终阶段仅改名，当前未置顶。其余103483行逐行保持，三个源数据库均与备份前完整行一致，五个QA原文件字节/metadata和三个附件namespace字节保持。没有新增Session、Message、执行轮次或Goal事件。

[runtime.json](runtime.json) 为三个实例的公开shutdown200、原exec/native/launcher0、物理/输出/请求结算与精确出生链退休。共用最初20:10:15.297Z截止，最少剩余1476514ms；catalog副本已退休，源auth/catalog metadata和catalog字节保持，无认证复制、实际模型0/累计767。

[checks.json](checks.json) 记录正式正向Server路由和租约测试、两次纠正后的类型/构建、SDK生成、OpenAPI与双语文档/语言检查。当前API读的是规范Project数据，name-only mutation不进入执行初始化/生命周期。Gateway的规范metadata读取有类型与API契约检查，未冒称真实Gateway执行环境验收。通用失败反馈、跨组置顶后的焦点与项目名全局搜索仍需后续批次深入体验，不将本批两项修复描述为全产品完成。
