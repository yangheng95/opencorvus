# 377 验收证据

实施依据为 [方案与 Recall](../locale-bootstrap-plan-377.md)。本轮单 agent；所有图已逐张人工查看，没有 UI 自动化断言。

| 实际页面 | 观察结果 |
| --- | --- |
| [嵌套入口与真实 Sources](after/01-nested-source.png) | /ui/inspect/resource/ 完整加载，Sol read 生成文件名与 L2–3，正文正常渲染。 |
| [打开来源](after/02-nested-source-editor.png) | 点击来源，真实延迟编辑器正常加载，原文第 2–3 行高亮。 |
| [根入口](after/03-root-source.png) | 返回 /ui/ 后重新打开同一实际会话，Source 和正文仍可读；图中保留真实侧栏悬浮提示。 |
| [真实缺失资源](failure/01-missing-catalog.png) | 私有正式产物移出 zh-CN.json 后启动；实际 HTTP 404 显示原始地址和 Retry。 |
| [实际重试](failure/02-retry-diagnostic.png) | 点击 Retry 发起第二次文档和语言请求，资源仍缺失时继续呈现明确诊断。 |

后端运行检查器读取真实请求日志、持久化 Source/ToolRequest/ToolOutcome、原输入文件完整字节和 Provider/Native 收敛事实。正常 scope 的两种文档入口均 GET /ui/i18n/zh-CN.json 和 en-US.json，四次 200；失败 scope 两次文档 200、zh-CN 两次 404、en-US 两次 200。唯一真实 read 为 offset=2/limit=2，Source range=2–3，与完整原始 ToolOutcome 相符。

正常 Native 88720ms、5 次 Sol 流式 HTTP 200/EOF；失败 Native 51374ms、2 次预检 Sol HTTP 200/EOF。两者均在原 600000ms/12 请求边界内；原 launcher 48038、42687 及各 shutdown 实际 exit0，Host/Native/output/request/端口与 auth/models 成对清理已闭合。自己创建的 202、203 页面已关闭，最终 IAB 页表为空。失败 scope 只有预检模型对话，不冒充失败页面已成功执行任务。

4 个语言加载服务合同、8 个断言通过；测试只证明加载数据与 HTTP/解析/对象形状错误合同。类型检查 66576 exit0；正式私有 build 53476 exit0、约 61s；真实页面执行 main-BuketuB2.js。公开表面安全检查、345 operations/25 groups 文档检查和 18 文档架构索引通过。原旧测试未运行，删除其不存在的 host override 和负向缓存断言；删除触及的启动 UI 模拟入口。

构建与运行均未操作用户窗口或共享 dist。失败副本逐个完整字节核对正式产物，唯一语言文件移到服务目录外保存原件；不是网络拦截、伪错误或 DOM 注入。源文件和完整日志压缩归档保留；任何摘要都不作为可变源码或 UI 验收门槛。

本轮未运行原生 Tauri 窗口、VS Code webview、反向代理或其他操作系统；也未模拟渲染函数本身抛错。错误呈现仅在本轮真实语言资源 404 场景得到页面验收，不能外推所有启动故障。Sources 样式本轮未改动，验证的是嵌套入口可进入真实会话和来源链路。
