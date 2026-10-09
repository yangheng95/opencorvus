# 253 主会话阅读返回位置修复

252真实来源区360切换返回后落到末尾。根因是Main没有按源记录阅读意图，所有普通Session/Task/Mission切换与恢复直接要求bottom（末尾）。本轮在现UI（User Interface，用户界面）状态保存最多50条Main位置，按同连接授权轮次/源身份隔离，退出旧投影前捕获可见真实位置与消息锚点。恢复沿原历史loader（载入者）、virtualizer（虚拟列表）和scroll controller（滚动控制器），不增加业务消息、模型/状态路由或另一份内容。

真实新Sol独立Main通过：来源318.6666564941406、中段1038.6666259765625往返保持同消息/偏移，明确末尾2550.666748046875/following=true再返回保持；截图人工查看。一次中段合并截图展示异常已保留，另外真实完整截图确认。15s生成帧有效，59s“growing”命名帧实际已终态，生成中切换没有被冒称通过。

类型/build（构建）0、renderer public surface（渲染器公开边界）1/1仅辅助；原Native71700/foreground56126正常0、7个gpt-6.1-sol流式200/eof（End of File，流结束）、固定10分钟/12预算内，物理/输出/请求/完整凭据对清理及独立退役观察0。所有原资料保存，最终精确私有归档自身文件。

[完整Recall与共享范围](../../artifacts/2026-10-05-connection-workspace-authority/main-reading-position-plan-253.md)及[实际页面](../../artifacts/2026-10-05-connection-workspace-authority/main-reading-position-253/live-01/README.md)记录根因、原失败、当前实现与限制。Task/Mission/长分页/授权更换/重试重启和原子Dock实时矩阵仍需独立补验。没有UI自动化或多agent工作，持续目标进行中。
