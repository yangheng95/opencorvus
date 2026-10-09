# 226 工作树列表真实读取

[实施前Recall](../worktree-reader-plan-226.md) / [完整启动准入](../worktree-reader-readiness-226/README.md)。225真实Environment工作树400后，单agent修复精确GET读取入口的模型耦合；所有写入/删除继续真实runtime契约。

## 功能和公开契约

GET /project/current/worktrees进入现有Project identity，仍使用同一个Worktree.listProjectWorktrees实现，返回真实primary/managed Git registry与removable事实。没有增加Task/Session身份、缓存、并行实现、模型或host语义路由。公开description同步实际字段；400目录/registry错误、412非Git先决错误、500服务错误描述、SDK及中英文API参考从当前generator生成。

原4项baseline实际2pass/2fail，自然退出1：真实primary/managed与两Project读取收到ProviderModelNotFoundError400。修复后首次19例17pass/2fail仅测试Windows路径表达不符当前Git porcelain规范正斜杠，生产路径不改，原失败保留。最终19pass/0fail/55expect，覆盖实际primary/managed列表、linked检出目录、真实lock/unlock与branch rename更新、两Project并行隔离、非Git412、缺directory400和DELETE原模型400；原VCS合同同时通过。[检查原输出](checks/README.md)，核心types/SDK/docs生成和检查实际0。

## 当前真实页面

- [英文Environment](after-01/environment-primary-loaded.jpg) / [中文Environment](after-01/environment-chinese-loaded.jpg)：实际main与1个未跟踪文件、单primary项目正常完成投影。对应真实页面发出的工作树GET在当前Native窗口原日志中completed/statusCode200，原请求ID完整保留。
- [原Sources文件打开](after-01/sources-file-opened.jpg)：中文来源展开、打开原README，编辑器实际原正文“Isolated formal Task resource qualification”可读；未编辑或重新运行历史对话。

三张截图均实际显示并人工查看。这个原历史项目只有primary，没有managed工作树分类；真实多managed列表的视觉密度本轮未覆盖，后端真实managed测试不能冒充该视觉矩阵。分支菜单transformCallback错误与computer MCP500仍未修复，后续继续。没有UI自动化测试、DOM/文案断言、快照、browser fixture或像素检查；未操作用户IAB23。

## 历史与实际终态

原90表逐行相等复制，保留原Project/directory/Session/Source。无auth/models复制，无新模型请求或Task/子agent重启。自身IAB48关闭，原exec7136实际退出0；Native实际exited0，physical/output/request完整结算true，在固定900000ms截止内退出。[原结算](after-01/worktree-reader-226-after-01-native-host-settled.json)和独立birth/端口/资料检查均保留，未以cleanup标志替代actual terminal。

[最终13表逐行核对](after-01/final-canonical-custody.json)全部相等，两个原Project无新增/删除条目；主Project仅.git目录mtime变化，原文件内容保持。全部观察/检查进程结束后，5个精确Native出生文件逐文件移到忽略的私有归档，[原归档事实](after-01/owned-native-pile-archive.json)。没有递归清理、终止用户进程或额外交付branch/worktree。

范围提交和正常上游同步推送后，持续goal保持active并进入下轮菜单和Sources体验修复。
