# 侧聊 Goal 与完整来源滚动

[方案与根因](../../records/2026-10/2026-10-23-side-goal-live-experience.md) · [实际模型、Goal、来源、数据及资源事实](evidence.json)

完整展开后的来源仍保留内部滚动容器和contain边界，但自身没有滚动范围，导致正文上的滚轮不能传给侧聊。共享CSS规则改为overflow:visible，与组件原有的外层阅读所有权一致。折叠和流中仍使用原来的有界内部滚动。

| 实际截图 | 观察 |
| --- | --- |
| [目标确认](goal-confirmation.png) | 同一侧聊名称、真实草稿、两轮预算 |
| [预算结束](goal-budget-ended.png) | 两次真实controller续跑，98693累计令牌 |
| [来源链接与回答](source-link-and-reply.png) | 原路径、域名、复制入口和真实回答 |
| [修复前正文滚轮受阻](before-source-wheel-trapped.png) | 展开后正文滚轮down1，外层位置仍595 |
| [修复前边缘滚动](before-gutter-scroll.png) | 相同down1在边缘使外层595→1315，原文可见 |
| [目标完成](goal-complete.png) | 人工记录证据后complete，累计用量保留 |
| [修复后正文可滚动](after-source-wheel-fixed.png) | 同一来源正文down1，外层610→1330，原文进入视野 |
| [折叠内部阅读](after-bounded-source-scroll.png) | 内部0→720，外层610保持；重开折叠恢复720 |
| [中文来源阅读](after-source-reading-zh.png) | 控件中文、原文保留，正文滚轮正常 |

九张图均已实际呈现并人工查看。只读DOM数据用于定位和解释观察，没有UI自动化断言、截图基线或像素差异测试。

两组共8次gpt-6.1-sol流式请求均200/原EOF；真实Goal两轮后预算结束并人工完成。两服务正常shutdown/native/原exec/launcher0，8份认证及目录副本退休。after复用了同一完整90表1847行来源，原Goal/消息/8008字节来源保持；只出现两条原租约的自然变化。完整Rendering生命周期仍是后续验收范围。
