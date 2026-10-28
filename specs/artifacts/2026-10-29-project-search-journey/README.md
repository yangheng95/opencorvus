# 项目搜索与键盘导航

对应[根因与实施记录](../../records/2026-10/2026-10-29-project-search-journey.md)。单代理真实开发 `/ui`，19张原始JPEG全部呈现并人工复核；没有UI自动化、DOM/文案断言或像素基线。改前[773图12](../2026-10-29-project-identity-journey/12-project-search-settled.jpg)在本批重新查看：既有名称搜索0结果。本批补齐原来只承诺Chats/work/commands的项目导航能力。

| 原图 | 实际观察与结果 |
| --- | --- |
| [01](01-empty-query-recents.jpg) | 空查询保留九个最近Chat/Work及原本地命令。 |
| [02](02-project-name-result.jpg)、[03](03-project-enter-selected.jpg) | 名称命中原Project身份，Enter回该项目首页。 |
| [04](04-project-id-result.jpg)、[05](05-comparison-project-selected.jpg) | 按规范标识命中752对照项目，Ctrl+1实际切换，异步结算后输入区取得焦点。 |
| [06](06-reading-before-search.jpg)、[07](07-project-directory-results.jpg)、[08](08-cancel-preserves-reading.jpg) | 原759对话中查752目录得到Chat/Project，Escape保留同一URL、Session和原阅读；07也暴露长目录将名称挤为0宽。 |
| [09](09-long-project-directory-repaired.jpg) | 名称独占一行，长目录完整换行，Anonymous project恢复可见。 |
| [10](10-project-query-first-page.jpg)、[11](11-project-results-continuation.jpg) | 同名匿名项目显示不同真实路径；实际Load more追加并人工滚到后续结果。 |
| [12](12-chinese-project-from-settings.jpg)、[13](13-project-selected-from-settings.jpg) | 中文设置页Ctrl+K查询原英文项目名，选择后关闭设置并回项目首页。 |
| [14](14-project-from-directory-free-home.jpg)、[15](15-directory-free-project-selected.jpg) | 中文关闭项目后，按对照Project标识查询并用Ctrl+1从无目录首页进入。 |
| [16](16-final-project-highlight.jpg)、[17](17-final-long-directory-results.jpg) | 最终普通构建包含完整候选选中背景，组标题分离，长路径名称保持可读。 |
| [18](18-final-empty-result.jpg)、[19](19-final-selected-home.jpg) | 新英文空状态清楚说明项目/对话/工作/命令范围，再Enter回原项目，结束前实际输入区焦点已收敛。 |

原图部分为1119宽的工具捕获，而页面布局宽1280；目标命令面板区域完整可见，按该区域审阅，不凭捕获边缘判定产品溢出。没有裁图、重绘或改变用户窗口。原对话的模型不可用提示属于隔离实例没有认证时的执行条件，阅读、Project导航仍正常，不能当作凭据或目录故障。

[toolchain.json](toolchain.json) 记录首个真实检查器在Cargo阶段的Windows拒绝访问，以及共享发布根因：编译器输出与运行中的exe原来同路径。修复后Cargo写独立build目录，完成文件经同父级完整目录发布，全部检查器读取唯一published位置。三个原checker从cold cache同毫秒启动均0；正式新增非UI测试实际观察运行文件exact_live时再发布、原进程完成输出和物理/输出结算。缓存位置选择不作为功能校验，未增加摘要门槛。

[checks.json](checks.json) 保存原失败和修复后的正式测试、前后端类型、普通build/renderer、三项并发原checker、2615键双语结果；这些不能代替上表实页。[data.json](data.json) 是三个克隆及各源库92表103484原行全部逐行相同、schema9/integrity ok，五原文件字节/metadata和三份附件namespace字节保持。没有新增会话、消息、Goal事件或Project metadata变更。

[runtime.json](runtime.json) 是三个实例的公开shutdown200、原exec36114/40878/24080与native/launcher0、物理/输出/请求结算及精确出生链退休。全部沿最初21:06:57.506Z截止，最少剩2511715ms，catalog副本清退，源auth/catalog metadata与catalog字节保持；无auth复制、实际模型0/累计767。用户18571及窗口未操作。

没有修改后端API、SDK、数据库schema或执行调度。没有新建Task/Mission/Session执行，也没有把旧Task结果冒充本批模型验收；非桌面、多宿主、错误重试和全部任务组合未覆盖。通用操作失败原位反馈和跨组置顶焦点仍留给后续持续体验，不把本批完成等同全产品完成。
