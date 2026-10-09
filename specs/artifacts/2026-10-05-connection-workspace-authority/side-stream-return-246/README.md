# 246 运行中返回故障与草稿请求归属修复

[Recall/根因/横审/实施准入](../side-stream-return-plan-246.md) / [原失败现场](live-01/README.md) / [修复后真实场景](review-01/README.md)。只root；两个独立新scope，原scene不重启、不延长。当前只修草稿HTTP成功清理被view disposal挡住的确定根因；运行正文前缀丢失仍未修复。

live-01确实把Side DOM移除，返回同SID/Message由649可见字符降为13，只从第6节中间继续；后续Working期间仍缺前半段，最终才恢复完整3331字符持久正文。最终输入仍显示233字符旧提交。review-01同动作再次由851→13，并在运行17:48:11直接读取canonical text=0，排除只因Markdown样式造成缺字的解释。

shared text producer运行中只发ephemeral delta，SSE重连snapshot只读canonical空Part，natural text-end才保存全Part，前缀问题位于共享Session/Task/Mission文本恢复契约；Main/subagent/Task replay/CLI/ACP均已横审代码边界，不能当作Side特例或模型问题。重启/error/串并行/多项目完整真实矩阵仍未达成，backend变更待独立实施方案/正向真实路径测试，不增加文本副本、LLM gate或界面猜补。

草稿修复只改Side send成功回包的清理条件：同API authority、当前scoped draft的submission Message ID与原请求完全一致、quotedPrompt未变，即清理；不依赖已经退役的component generation/selected view。error/sending UI仍只由原view更新。保留原HTTP同步等待、重试身份和改稿/引用恢复，不新增derived completion effect。

review-01正常完成后空输入72px、可写、composer135px、reading388.333px；同SID/Message、6编译块/3253显示字符及3524原文，代码截图人工查看。参考历史展开发生在EOF之后，不假称该次是stream中Source阅读。

types95650/build40610实际0（58.40s，renderer public surface1/1也0），真实after bundle main-D_-2LIPy.js。两个Native/原foreground72950与97710均实际0、分别9/12 Sol streaming200/source EOF、预算未耗尽、pair/full chain退役与独立checker0；原8989与after8502实际新日志unknown0。各5个自有Bun文件在所有observer终态后精确归档。无UI自动化，没有用户进程/窗口操作。Source上游缺字与原243期限失败保留，goal active。
