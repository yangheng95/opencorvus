# 253 主阅读区的位置恢复

主阅读区现在在现UI（User Interface，用户界面）状态中保存最多50条源位置，按实际连接授权轮次与Task/Session身份隔离。选择前同步保存可见reader（阅读器）的真实位置与消息锚点；返回后经原历史载入与virtualizer（虚拟列表）找到实际消息，再通过原scroll controller（滚动控制器）恢复。新源跟随末尾，明确用户移动或滚到最新覆盖旧位置，空载入和退休拥有者不能写入新位置。

- [Recall、共享入口与方案](../main-reading-position-plan-253.md)。
- [真实页面结果及原范围](live-01/README.md)。
- [架构当前契约](../../../current/architecture/07-panel-reactivity.md)。

当前新Sol普通Main与已有preflight（启动验收）跨两个Project实际往返：来源区318.6666564941406、正文中段1038.6666259765625均保持同位置与同消息偏移；明确Scroll to bottom（滚到末尾）后的2550.666748046875/following=true也保持。root亲自查看截图，类型/build（构建）0只作辅助。原252阅读返回末尾失败保留，没有改写旧证据。

原foreground（前台命令）56126实际join（等待完成）0，Native（原生进程）71700正常0，固定10分钟内闭合；7次实际Sol请求全部流式200/eof（End of File，流结束），完整auth/models配对验证与退役、独立端口/进程观察完成。没有UI自动化或新子agent。

本轮已验证普通Main与消息锚点/跟随意图，Task/Mission真实页面、跨历史分页、授权更换、重试重启及生成中切换仍需实际补验，不能由同代码或这些短对话推导通过。原ResearchStudio子Dock实时全部Rendering（渲染）帧仍未验证，持续目标保持进行中。
