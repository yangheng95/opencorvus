# 253 live-01 新普通会话复测

独立开发`http://localhost:18187/ui/`，自身IAB（In-App Browser，应用内浏览器）94，实际[构建资源](served-assets.json)main--d2TSAAV.js。当前Main Session ses_-zUSPAyDozzs1uUI2EIu、Project prj_hQ8TlSLhiTsg4VomEyQS；现preflight（启动验收）ses_hxmvTNFH0rUgLM8Gb5bJ、Project prj_h43iYDHqKqsAQX5htWd2，身份以[完整canonical记录](canonical-current-conversations.json)直接核对。原输入沿252相同三页只读请求，真实模型自然生成，没有注入Source、Message或状态。

## 人工视觉与意图

- [真实生成15s](main-progress.jpg)：Running（运行中）、三条真实WAI（Web Accessibility Initiative，网页无障碍倡议）/MDN（Mozilla Developer Network，开发者文档）标题与域名、指南开头；[实际几何](main-progress.txt)和工具只读观察显示following=true。
- [随后暂停照片](main-paused-growing.jpg)虽按原计划命名growing，实际59s/Not running，不能当成生成中暂停或运行中切换通过。原始记录保留。
- [来源区离开前](main-before-return.jpg)/[几何](main-before-return-geometry.json)22:11:17.560Z：[返回后](main-return-settled.jpg)/[几何](main-return-settled-geometry.json)22:11:53.875Z，top均318.6666564941406、following=false、635视口/3186内容、固定59s。相同用户引用偏移-228.00001525878903、前导Message109.09375、指南Message431.3958282470703保持，实际三来源同屏。
- [中段离开前](main-middle-before.jpg)/[几何](main-middle-before-geometry.json)22:12:25.437Z：[最终中段返回照片](main-middle-return-final.jpg)/[稳定几何](main-middle-return-geometry.json)22:12:49.907Z，top均1038.6666259765625、following=false，实际WAI第二项/MDN第三项段落保持，指南Message偏移-288.6041717529297保持。
- [明确滚末尾观察](main-latest-geometry.json)22:13:25.225Z：[返回后](main-latest-return.jpg)/[几何](main-latest-return-geometry.json)22:13:42.045Z，均2550.666748046875、following=true。当前用户的新意图覆盖旧暂停位置，不再恢复之前的Source/中段。

一次main-middle-return的合并捕获图在工具展示为异常白色小图，原文件保存；另取main-middle-return-final.jpg并亲自确认完整页面。不把几何或无错日志当视觉替代。导航每次用新鲜AX（Accessibility Tree，无障碍树），未执行UI自动化断言、截图比较或循环；“Root只读观察”是同页真实几何辅助。

## 实际运行闭合

[preflight](main-reading-position-253-live-01-preflight-ready.json)分别确认可用凭据、完整models目录投影与实际gpt-6.1-sol流式模型；[成对移交](main-reading-position-253-live-01-provider-pair-staging.json)不只移交auth。源凭据内容经现CredentialRedactor处理，不入日志/spec/Git。

固定600000ms截止1791584343200，原窗口内唯一退出。94于2026-10-09T22:14:36.420Z关闭，[shutdown](shutdown.log)实际0，原foreground56126实际join0。[原Native结果](main-reading-position-253-live-01-native-host-settled.json)：Target71700/win32:639271805439969666、Host74384/win32:639271805432150802于22:14:50.431Z正常0，physicalCompletion/outputDrainComplete/requestCleanupComplete（物理完成/输出排空/请求清理）全真；[唯一清理](main-reading-position-253-live-01-physical-terminal-and-pair-cleanup.json)与[独立读回](closure-readback.json)证明精确进程退出、18187无监听，复制auth/models均移除。

[实际Provider审计](main-reading-position-253-live-01-final-provider-audit.json)7次全部gpt-6.1-sol/stream/200/reader eof，12预算内；[资格记录](main-reading-position-253-live-01-qualified-surface-completion.json)只证明物理/模型范围，视觉仍以实际截图为准。[当次日志](main-reading-position-253-live-01-runtime.log)11464行、[时间边界](main-reading-position-253-live-01-http-summary.json)未知时间0，原私有日志保留。[类型](types.log)、[构建](build.log)原命令各0，构建约1分钟、公开渲染边界1/1，仅辅助。

[精确自身文件归档](owned-native-pile-archive.json)在全部原命令、观察、归档和checker（检查器）完成后，只移动本次创建的五个.debug.pile。公共日志/AX仅统一换行和行尾空白，原字节私有保存，截图/失败事实不修改。

普通Main/两个真实Project往返通过；Task、Mission、长历史分页、确认换授权、错误/重启与生成中切换尚未物理复测。未派Codex子agent或新应用子会话，本Scope不能替代原ResearchStudio子Dock实时全帧验收。
