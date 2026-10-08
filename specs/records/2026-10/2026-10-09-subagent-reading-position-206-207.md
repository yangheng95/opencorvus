# 子侧栏 Sources 阅读连续性206/207

## Recall

用户要求持续自主改进 UI（User Interface，用户界面）、功能和缺陷，重点指出 Sources 显示及子 agent 侧栏 Rendering 闪烁；最新明确要求只使用单 agent。本轮根因调查、实施前方案、全部调用点与验收范围见 [Recall](../../artifacts/2026-10-05-connection-workspace-authority/subagent-reading-position-plan-206.md)。没有委托，也没有重新执行原153模型任务。

205已证实同会话返回时正文完整，但 top0/follow=false 变成2330.666748/follow=true。直接触发为目标变化卸载滚动 owner，新组件和共享初始化均落尾。第一次修复后的206又揭示 Dock 关闭/重开几何钳制以及宽度过渡引发的后续锚定位移。两次失败为1440→1040、890.666687→490.666656，原始证据完整保留。

## 当前实现及验收

子侧栏唯一外层 owner 保存最多32个规范 targetKey 的阅读位置及跟随意图；仅可见且 active 的观察更新，卸载外层清理。外层保留，inactive 请求仍取消，转录 owner 按当前身份卸载。共享 setupAutoScroll 明确初始 bottom/position 合同，原三调用者同步更新。位置恢复通过已有帧调度与 ResizeObserver（尺寸观察器）等待内容可达及 Dock/内容几何稳定，真实阅读输入取消恢复。没有第二转录、隐藏消息、定时旁路或旧接口兼容。

完整原153历史分别复制到206、207，两份全90表实际行内容一致，原任务/项目/会话身份不变。通过正常生产 serve 的 `/ui` 与独立真实页面交互并人工查看截图。最终207服务记录 `/ui/`200、`/ui/assets/main-3EEyiWb9.js`200；Sources 顶部切换返回仍 top0/follow=false、第一项展开、24段/3标题；All agents 中段返回1440保持；Dock关闭重开858.666687保持；主动向下到尾 follow=true。证据见 [目录](../../artifacts/2026-10-05-connection-workspace-authority/subagent-reading-position-206/README.md)。没有新增、修改或运行 UI 自动化测试。

最终 overlay 类型检查退出0；真实构建51.17s退出0，共享 renderer public surface 检查通过。文档检查在交付时执行。206原父工具42177退出0，207原父工具12435退出0；对应实际 Native Handle terminal 为 exited/0，output/request cleanup 完成，独立精确进程身份死亡、端口关闭、auth/models pair 关闭已记录。自己创建的两个页面已关闭；原153未重启。

## 限制与后续

本轮为无凭据的完整历史阅读，不是新的 GPT-6.1 Sol Provider 端到端资格；页面的模型配置提示与隔离范围一致。原205深色 Sources 证据保留，207位置场景为浅色。流式内容增长、更多会话淘汰、触摸、冷长内容分批恢复、跨连接/目录切换及恢复中的主动取消仍需独立真实场景；不把类型检查或截图采样推广为完整矩阵，也不宣称持续迭代目标完成。
