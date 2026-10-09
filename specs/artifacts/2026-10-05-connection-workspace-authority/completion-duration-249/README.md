# 249 完成耗时与显示时钟

单 agent 修复 Side 卡片遗漏同消息的真实完成时间，结束后共享耗时组件继续显示固定值。子会话 Dock 从同一 selected activity（所选执行记录）获得 startedAt/completedAt，不再把可见历史第一条消息当作当前执行时钟；pending/running/idle 不取旧终态时间，记录与 transcript（对话记录）必须匹配同一 Session。内容投影明确不含时钟字段，由唯一呈现 caller（调用者）补齐真实当前执行时间，没有估算终态时间或兼容计时来源。

- [Recall、原根因、共享影响和实施准入](../completion-duration-plan-249.md)。
- [真实页面证据](live-01/README.md)：Working（生成中）31s、完成固定1m9s、整Dock关闭重开保持、真实来源与正文。
- [初次类型诊断](checks/typecheck.log) / [最终类型检查](checks/typecheck-02.log)：原TS2741/exit2保留，准确声明内容投影的部分类型后最终0。
- [初次构建](checks/build.log) / [最终构建](checks/build-02.log)：实际各0，最终48.53s、renderer public surface（渲染器公共边界）1/1，仅辅助验收。

本轮没有 UI（User Interface，用户界面）自动化；未修改或运行既有transport（传输）数据测试。真实Side复测通过，子Dock时间映射是代码/类型证据，原Research子agent Dock的真实完整闪烁和时间复测尚未达成，不能由Side推导。

当前静止阅读的同一标题与首段对象，在Working和terminal（终态）前后保持同样边界；旧248按Home/PageDown后取得的照片不能据此判定持续垂直跳动的根因，采样/键盘滚动与绘制顺序仍未知。本轮不追加猜测布局补丁，也不宣称所有Rendering帧、语言主题、错误/重试视觉或表格全部行列已验收。全目标持续active（进行中）。
