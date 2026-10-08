# 子侧栏 Sources 阅读位置206/207

## Recall 与范围

持续单 agent 产品体验迭代，重点为 Sources 阅读及子侧栏 Rendering。实施前调查及两次失败见 [方案](../subagent-reading-position-plan-206.md)，历史启动准入见 [205](../child-history-readiness-205/README.md)。当前只改前端阅读状态及共享滚动初始化，不重新执行原153 Task，不使用凭据，不修改 Provider、队列或终态。

原子会话 `ses_hMlVNrRdOLxQf4XhSds7` 的第一次返回位置失败已保留于205。206修改消除了切换/All agents 的初始落尾，但 Dock 重开分别从1440变1040、890.666687变490.666656。可见性 guard 只能保护最后可见状态；宽度过渡及 browser anchoring（浏览器锚定）还会使一次性恢复后漂移。最终207将同一恢复目标保留至已有布局/内容观察确认几何稳定，原始失败不重写为成功。

## 当前合同

外层子侧栏保存规范目标身份的 top/following，最多32最近项，不缓存消息，inactive 仍取消请求；内层按身份挂载。共享滚动控制器的 initialPosition 必填为 bottom 或 position，position 绑定实际 right-dock 布局 owner。内容不足时等待 resize，几何稳定后释放；同一 owner 的真实输入取消恢复。Main 与 Side Chat 显式保持首次落尾合同。现行架构见 [07](../../../current/architecture/07-panel-reactivity.md)。

## 实际证据

| 场景 | 最终观察 | 证据 |
| --- | --- | --- |
| Sources 顶部→真实 tester→researcher | top0/follow=false、height2908、24段/3标题、第一 Source 展开保持 | [前](final-207-01/top-before.json)、[返回事实](final-207-01/top-return.json)、[立即截图](final-207-01/top-return-immediate.jpg) |
| 中段→All agents→researcher | top1440/follow=false、height2908保持 | [事实](final-207-01/all-agents-return.json)、[截图](final-207-01/all-agents-return.jpg) |
| 关闭→重开 Dock | top858.666687/follow=false、height2875保持 | [前](final-207-01/panel-before.json)、[返回](final-207-01/panel-reopen.json)、[立即截图](final-207-01/panel-reopen-immediate.jpg) |
| 主动向下到尾 | top2330.666748、follow=true | [观察](final-207-01/explicit-bottom.json) |
| 原206第一次重开失败 | 1440→1040 | [事实](live-01/researcher-panel-reopen.json)、[截图](live-01/researcher-panel-reopen-immediate.jpg) |
| 原206第二次重开失败 | 890.666687→490.666656 | [前](live-01/final-panel-before.json)、[返回](live-01/final-panel-reopen.json)、[截图](live-01/final-panel-reopen-immediate.jpg) |

所有最终截图已人工查看，观察 JSON 不是自动化测试。当前构建 `main-3EEyiWb9.js`51.17s/退出0、overlay 类型检查0，共享 renderer public surface 检查通过。最终207原生产请求日志保留 `/ui/`200及最终 JavaScript（脚本）资源200，见 [HTTP原始请求](final-207-01/child-reading-final-207-01-http-summary.json) 与 [实际运行日志](final-207-01/child-reading-final-207-01-runtime.log)，不是从构建文件名推测200。

两个副本均以完整原153 runtime 和90应用表实际行内容一致准入：[206复制](live-01/child-reading-after-206-01-history-copy.json)、[207复制](final-207-01/child-reading-final-207-01-history-copy.json)。206父工具42177退出0，207父工具12435退出0；原生产 Handle exited/0 与 output/request cleanup：[206](live-01/child-reading-after-206-01-launcher-native-joined.json)、[207](final-207-01/child-reading-final-207-01-launcher-native-joined.json)。独立 OS（Operating System，操作系统）身份/端口/凭据 pair 闭合：[206](live-01/child-reading-after-206-01-independent-closure.json)、[207](final-207-01/child-reading-final-207-01-independent-closure.json)。自己的页面19/20已关闭，原153保持关闭。

原153两个 Project 的44/97项 [lstat元数据观察](source-project-metadata-after-207.json) 均保持；此处不宣称文件内容身份验证。仅本轮原生观察器生成的5份调试文件已按精确出生时间及工作区边界移至私有临时目录，[移交记录](generated-native-observer-custody.json) 保留；没有清理整个目录或其他任务文件。文档检查345ops/25groups通过。

## 未覆盖范围

这轮完整历史无 auth/models，不是新模型请求验收。配置提示不是用户 auth 异常。实际主动到底通过，之后没有新消息增长，因此流式增长跟随仍未知；32项淘汰、跨连接/目录、触摸、冷长内容与恢复中的取消也未验。207浅色位置场景不能宣称最终深色完整矩阵。泛化 Rendering 的全部入口仍待继续自主体验。
