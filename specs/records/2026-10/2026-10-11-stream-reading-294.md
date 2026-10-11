# 294 完整正文流式与 Sources

单agent。293已修复错误呈现，但其12请求预算耗尽，没有完整正文；本轮以此前真实已见的两份官方来源完成新的普通Main问题，启动前设20累计请求预算，原293失败不改写。6次实际gpt-6.1-sol请求均streaming/HTTP200/reader EOF、未耗尽；Main最终stop，真实产生两Source、3249字符六节正文及表格/代码。

Root在18s首段、39s第三节追加、70s第六节追加等语义时点亲自截图。主动回读后两次截图的首节实际段落保持相同位置，top386/follow=false，文档总高1363→2544；完成后Source链接键盘焦点及完整Tooltip正常，显式回底后follow=true。没有以DOM数值代替视觉、没有UI自动化，也没有据正常截图制造源码补丁。

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/stream-reading-plan-294.md) / [实际截图、Provider与保管](../../artifacts/2026-10-05-connection-workspace-authority/stream-reading-294/README.md)。原前台8944/Native67744实际0，09:57:40.057Z闭合，原600000ms余434209ms；独立closure、认证配对退役和自产物保管完成。

正文观察覆盖当前Main共享渲染，并非原ResearchStudio子侧栏或全帧录像。ResizeObserver delivery报告仍出现且根因未定位；本轮所见读位稳定不代表所有观察者无问题。当前未复现新的可据证修改的产品缺陷，源码保持；goal继续active。
