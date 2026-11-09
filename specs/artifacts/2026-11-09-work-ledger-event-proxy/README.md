# 工作侧栏事件：验收代理与真实对照

| 截图 | 实际观察 |
| --- | --- |
| [01](01-first-owned-project-sidebar.jpg) | 旧代理中，读取顺序正常时仍可显示已有项目 |
| [02](02-race-work-ledger-after-path-admission.jpg) | 保留升级的代理中，延迟路径读取仍显示项目 |
| [03](03-http-only-sidebar-stays-stale.jpg) | 服务已登记第二个目录，旧代理的打开页面仍显示一个 |
| [04](04-upgrade-proxy-sidebar-updates.jpg) | 完整事件连接收到通知，页面自动显示两个 |
| [05](05-keyboard-opens-live-added-project.jpg) | 键盘打开新增项目，标题与焦点对应实际目标 |

[桌面事实](observed.json)，[普通请求对照](before-proxy.log)，[只延迟路径轮次](race-proxy.log)，[后续完整代理记录](reorder-proxy.log)，[配对和持久状态审计](owned-ledger-audit.json)。[旧代理侧接口事实](before-ledger-project-registration.json)、[完整代理侧接口事实](reorder-ledger-project-registration.json)由[在线检查器](check-ledger-project-registration.mjs)取得，两个结果均对照真实开发服务的接口说明。

[工作侧栏验收代理](work-ledger-proxy.mjs)在 Windows 用 Node.js 运行。参数是代理端口、同机自有服务端口、可选实验延迟毫秒（默认 0）。只监听本机，HTTP 按请求转发，WebSocket 保持双向字节，输出中不包含升级凭据。可选延迟只影响此规格列出的六条已观察项目路径；该模式用于诊断，请保留与默认实况的区别。通过审计中已验证拥有者的本地关停接口清理测试进程。不要用于真实账户或用户工作窗口。

完整代理的两次真实连接返回 101，13 条由浏览器代理发出的相关请求与实际服务编号匹配；两次登记各有三个服务契约回执。三份隔离数据库有 2、1、2 个自有项目，均零会话、消息、执行任务、模型用量和 Provider 请求。源文件与 Git HEAD 保留，六个自有进程均退出 0，六个端口释放。
