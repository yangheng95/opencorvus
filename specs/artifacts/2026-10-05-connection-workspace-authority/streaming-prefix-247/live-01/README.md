# live-01 原始验收边界

Main `ses_-zUSQ4siuzztyb6kc3Rw` 实际产生 4 个 Source URL；Side `ses_-zUSQ4jntzz0PCgcr2Pp` 继承 4 条消息及对应来源。新 Assistant `msg_g0VXZvKdk001hjzTYaPE`，正文 Part `prt_g0VXZvLq9003MzXkUuq5`，最终 3742 个原始字符。

[关闭前照片](side-before-close.jpg) 显示 Working，1509 个显示字符；[卸载记录](side-closed-geometry.json) 于 18:29:19.837 UTC 确认 Side DOM 已移除。但 [重开照片](side-reopened.jpg) 和 [数据库回读](live-canonical-metadata.json) 分别发生于 18:33:07.824、18:33:20.251 UTC，晚于 Source reader 最后字节 18:30:00.040、EOF 18:30:00.197 及 Message 完成 18:30:00.252。这两份终态证据不能证明运行中恢复，补验使用新的 review-01，不重启本次服务。

[结束照片](side-terminal.jpg) 与 [输入事实](side-terminal-geometry.json) 确认完整正文、空且可用的 72px 输入框。[原 Provider 请求](streaming-prefix-247-live-01-final-provider-audit.json) 为 9/12 次实际 Sol 流式 200/EOF；[Native 原结果](streaming-prefix-247-live-01-native-host-settled.json) 为 exit 0。[独立回读](closure-readback.json) 与 [成对清理](streaming-prefix-247-live-01-physical-terminal-and-pair-cleanup.json) 确认物理/输出/请求结束、端口释放、auth/models 同时退役。原 foreground 91189 实际 join exit 0。完整脱敏运行日志按实际 Target 出生过滤 12062 行，未知时间 0；全部 observers 结束后才归档本次 5 个精确 Native pile。
