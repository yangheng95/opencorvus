# 225 VCS事实读取与中文Source

[实施前Recall](../vcs-source-plan-225.md) / [启动前沿](../vcs-source-readiness-225/README.md)。本轮只由单agent实施，沿用原222自然Source完整历史和原Project/Session/directory。

## 功能结果

GET /vcs、/vcs/branches、/vcs/diff使用现有Project身份读取实际Git事实，模型缺失不再阻断只读信息；POST写入与模型流式请求仍使用真实runtime校验。info/branches复用现有currentBranch物理读取，switchBranch显式重新初始化原监听owner。公开错误、SDK和中英文API文档同步当前契约。

两个原Git探针在真实分支更名后仍返回旧branch/current=false，原失败完整保留；linked checkout原路径已正确，排除目录混用猜测。最终38例/101断言通过，覆盖冷读取、真实更名、linked checkout、多Project串并隔离、非Git明确状态/412、写入模型错误与监听生命周期。旧candidate/锁测试移到同一完整Bootstrap的/session/status。原/command额外MCP.prompts连接computer失败500另行保留，不用该错误归因模型或候选恢复。

类型、SDK生成、前端构建、文档生成与检查实际0；[检查原输出](checks/)保留首次35pass/3fail、诊断1pass/1fail与最终38pass/0fail，失败未覆盖。

## 真实页面人工复核

- [英文General](after-01/general-english.jpg)、[中文General](after-01/general-chinese.jpg)：实际通用设置正常可读。
- [中文来源打开](after-01/localized-source-opened.jpg)、[来源返回](after-01/sources-return.jpg)：“打开来源文件”打开原README正文，文件来源身份和自然消息完整保留。
- [实际Git与工作树错误](after-01/environment-git-and-worktree-error.jpg)：实际main分支和1个未跟踪文件显示；工作树仍返回ProviderModelNotFoundError 400，未解决。
- [分支操作原错误](after-01/branch-action-errors.jpg)：点击当前分支触发transformCallback错误，分支选择交互本轮未通过，继续根因调查。

这些截图均实际显示并人工查看；DOM文本仅辅助定位，不作为UI验收。未创建、运行或更新UI自动化测试，未刷新用户IAB23。

## 实际运行与资料完整性

自身IAB47已关闭。原exec10041实际退出0；[Native原结算](after-01/vcs-source-225-after-01-native-host-settled.json)是exited0，physicalCompletion/outputDrainComplete/requestCleanupComplete均true，并在固定900000ms期限内完成。独立birth/端口/权限资料检查闭合。没有复制auth/models、调用新模型或重启历史Task/子agent。

[最终完整行核对](after-01/final-canonical-custody.json)逐行核对原13表，保留原Session/Message/Part与工具/Provider记录。原两个Project无新增或删除条目，主Project仅.git目录mtime发生变化；原文件内容保持。5个精确Native出生文件在全部本轮观察/检查进程闭合后逐文件移到忽略的私有归档，[归档事实](after-01/owned-native-pile-archive.json)保留出生时间和路径。没有删除或改动用户进程。

Sources多种类与长期流式矩阵仍继续迭代；Environment工作树、分支交互和MCP连接问题没有冒充本轮通过。
