# live-01 新构建的真实耗时复核

Own IAB（In-App Browser，应用内浏览器）91 实际使用开发 `http://localhost:18184/ui/`，加载 [main-CvIYQtNa.js](served-assets.json)。Main `ses_-zUSPoDO8zzwTek0z4Xt` 真实Source URL4/结论277字符；Side `ses_-zUSPo7AjzzD0XQkUcFT` 继承4条消息及相应来源。新User `msg_2ab387b7-b776-4ec4-bdb4-e1866c66a052` 为233字符；Assistant `msg_g0VXaByDO0097NwkUzpI`，正文Part `prt_g0VXaBzTB00hXUaexz83` 最终3295原始字符。

[原SQLite标量](live-canonical-metadata.json) 与 [canonical（持久事实）](canonical-current-conversations.json) 给出 Message.created=19:34:47.734 UTC、completed=19:35:57.543 UTC，实际间隔69809ms。页面固定显示1m9s，与现formatDuration（耗时格式化函数）的整秒显示相符。Part.start仍被旧natural text-end（自然文本结束）写成end，本轮没有修改该后端契约；它不参与本耗时组件。

| UTC观察 | 实际事实 | 原证据 |
|---|---|---|
| 19:35:19.825 | Working、31s、正确格式首段；scrollTop407.3333435058594、标题top151.59375/height20、首段top185.59375/height117.55208587646484 | [运行照片](side-running-reading.jpg)、[边界](side-running-reading-geometry.json) |
| 19:35:57.292 / .482 / .543 | Source reader（源响应读取器）最后字节 / EOF（End of File，流结束）/ Message完成 | [原Provider](completion-duration-249-live-01-final-provider-audit.json)、[canonical](canonical-current-conversations.json) |
| 19:36:28.033 / .235 | 终态1m9s，截图前后读取一致；同scrollTop/标题/首段边界保持，reading466→388 | [前边界](side-reading-later-before-geometry.json)、[照片](side-reading-later.jpg)、[后边界](side-reading-later-after-geometry.json) |
| 19:37:37.637 | 人工ArrowUp（上箭头）露出标题，scrollTop367.3333435058594，固定1m9s；首段top225.59375 | [固定耗时照片](side-terminal-duration.jpg)、[边界](side-terminal-duration-geometry.json) |
| 19:37:38.467 | 整Dock关闭确实卸载后返回，同SID/Message、1m9s、scrollTop367.3333435058594及标题/首段边界保持 | [关闭](side-closed.txt)、[重开](side-reopened.jpg)、[边界](side-reopened-geometry.json) |

当前终态与重开照片均实际呈现，由root人工查看。截图与键盘滚动同一帧边界不能被静态DOM（Document Object Model，文档对象模型）数字替代；本次绑定对象的静止观察支持局部保持，不扩大为全帧视觉不变。来源展开后 [真实标题/域名及5s抓取耗时](reference-sources.jpg) 可读；[代码](side-terminal-code.jpg) 和 [表格部分](side-terminal-table.jpg) 可见，表格没有全视窗覆盖全部行列。Side输入为空且可用；原子Dock未实测。

Own91关闭，sole shutdown（唯一退出入口）之后原foreground（前台命令）62209实际join exit0。Target71392/Host75620的 [原Native结果](completion-duration-249-live-01-native-host-settled.json) 于19:39:27左右正常exit0，早于原固定期限；12累计预算内实际9次gpt-6.1-sol、stream/200/EOF。[预检](completion-duration-249-live-01-preflight-ready.json) 分别证明凭据usable（可用）、完整catalog projected（模型目录已投影）及actual model/stream（真实模型/流式）；[独立closure（闭合回读）](closure-readback.json) 和 [物理/输出/请求/成对清理](completion-duration-249-live-01-physical-terminal-and-pair-cleanup.json) 确认端口/进程退役、auth/models同步清理。脱敏新日志10893行、未知时间0，原期限和失败未重写。

[5个精确自身pile（Native生成文件）归档](owned-native-pile-archive.json) 在原页面/运行链及当时observers（观察器）结束后完成。后来追加19:41:47.820的终态SQLite只读标量以核对69809ms，原Bun命令实际0，没有新Native pile或活进程；保留这个真实先后顺序，不称它为运行中数据库证据。用户18107/IAB23未操作。
