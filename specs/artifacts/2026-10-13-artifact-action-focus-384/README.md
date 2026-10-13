# 384 产物操作焦点与语言证据

对应[实施记录](../../records/2026-10/2026-10-13-artifact-action-focus-384.md)；全屏菜单仍待[386调查](../../records/2026-10/2026-10-13-artifact-fullscreen-menu-386.md)。本目录不是 UI 自动化测试或截图基线。所有截图由主 agent 操作真实桌面页面后保存并人工查看，没有像素、DOM、文案或组件断言。

## 已确认结果

- [前态焦点](screenshots/before-copy-focus.png)与[复制后失焦](screenshots/before-copy-completed.png)：真实 URL 附件的异步复制临时使用原生 disabled，操作结束焦点已离开按钮。
- [后态复制](screenshots/after-copy-focus.png)与[下载返回](screenshots/after-download-focus.png)：键盘连续操作保持对应控件焦点；[实际下载检查](after-download-check.json)逐字节核对14687字节原文。
- [最终中文文件](screenshots/final-chinese-file-copy.png)、[中文文档](screenshots/final-chinese-document.png)和[英文文档](screenshots/final-english-types.png)：类型、操作与反馈使用当前界面语言，原始标题、文件身份和双语正文保留。
- [全屏复制](screenshots/after-fullscreen-copy.png)通过；它不代表全屏下载菜单通过。

## 真实模型与物理收尾

[规范事实](canonical-before.json)与[checker结果](canonical-check.json)证明真实用户上传、两个消息拥有的发布产物和最终助手停止。成功轮次有7次实际gpt-6.1-sol流式HTTP200/EOF（End Of File，流结束）；原始审计为[无损压缩JSON](before-02-live/artifact-action-focus-384-before-02-final-provider-audit.json.gz)。首次预检的服务端overloaded失败也保留在[failed.json](provider-before/evidence/failed.json)，不计业务成功。

[模型配对清理回执](before-02-live/artifact-action-focus-384-before-02-physical-terminal-and-pair-cleanup.json)与[原启动句柄join](owner-handle-joins.json)分别证明真实模型owner和四个无凭据复核服务正常结束。无凭据服务复用同一已完成会话的规范数据；未重新创建产物或发送模型请求。它可能由正常发现流程重建公开模型目录，这不等于复制凭据尚未清理。

## 未完成边界

[原版全屏Download焦点截图](screenshots/baseline-fullscreen-menu-focused.png)后单独Enter触发与两个改后tab相同的控制超时。前态对照排除本次首次引入，精确失效机制仍未知。全屏菜单打开/选项/下载返回不合格；相关旧tab关闭未确认，服务终态固定的“PageClosed”式原因不能当作关闭证据。[人工复核记录](manual-review.json)列出各tab与每项限制。

未实页覆盖慢操作重复触发、无结果MCP（Model Context Protocol，模型上下文协议）App禁用与其它18个renderer布局；不将源码审阅、构建或类型检查冒称这些项目的通过。系统剪贴板读回也不属于本次焦点结论。

## 检查与归档

`typecheck-final.exit.txt`、`build-final.exit.txt`、`i18n-final.exit.txt`均为0；对应日志保留为无损`.gz`。语言检查覆盖2目录2178个键；构建有既有大chunk警告。UI改动没有新增或运行自动化测试。最初规范checker的Python编码别名错误修正为`utf-8-sig`后重跑通过，不改变产品合同。

[归档清单](archive-manifest.json)明确列出76项输入、输出、检查器、物理回执和截图。文本经过内存凭据去除与已知凭据扫描，未归档auth/models、数据库、整个runtime或运行二进制。下载原文件留在用户Downloads目录，不清理用户目录。
