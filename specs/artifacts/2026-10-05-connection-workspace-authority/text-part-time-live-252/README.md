# 252 当前真实Sol正文与Sources

root单独完成当前251后的新远端验收，没有Codex委托或新应用子会话。真实普通Work Chat读取三个公共页面，实际生成来源、格式化正文和终态时间；并发现返回主会话后阅读位置丢失，原失败保留，尚未修复。

- [Recall、原范围与固定10分钟](../text-part-time-live-plan-252.md)。
- [真实页面、持久事实与正常退出](live-01/README.md)。

授权凭据与完整models.json同时移交，当前实际preflight（启动验收）分别确认credential usable/catalog projected/actualModel gpt-6.1-sol/streaming。原服务累计7次请求，全部gpt-6.1-sol、流式200、实际reader EOF（End of File，流结束），12预算内。原foreground（前台命令）35713 join（等待完成）实际0、Native（原生进程）68380正常0，物理/输出/请求/凭据对全部退役。没有延长、重启或换预算。

生成中同一正文Part为2405字符、start1791579131656；自然结束3681字符，start仍为1791579131656，end1791579202040，实际跨度70384ms。结束后真实只读库再核对同Session/Message/Part和直接接受的原输入；观察只保留长度，不能由长度冒称全部前缀字节一致。当前UI（User Interface，用户界面）实际显示三条完整来源标题/域名和固定1m29s，人工查看生成中格式与终态代码/列表。

主会话阅读位置从来源区360，切换已有preflight会话再返回后稳定到2787.333251953125。即时空白加载帧与随后已恢复正文的帧分开保存，不把加载帧说成正文丢失，也不能由两次观测推断全程加载耗时。共享代码已定位：普通会话、Task、Mission初次/恢复路径都请求bottom（末尾），Main只初始化跟随末尾；现conversation-ui只存展开、来源摘要与Side阅读状态，没有Main按会话的阅读位置。Side/子Dock已有同一setupAutoScroll primitive（基础组件）的恢复契约，不能用它们通过替代Main。下一批继续完整根因与共享影响分析后落盘修复方案。

本轮没有生产代码改动或UI自动化。原ResearchStudio子Dock实时/全部Rendering帧、其他主题及错误重试仍未证明，持续目标保持进行中。
