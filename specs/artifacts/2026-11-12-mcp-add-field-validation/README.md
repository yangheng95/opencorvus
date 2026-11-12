# 新增连接字段验证的真实桌面与请求

本人用隔离有头 Chrome 与开发服务的 `/ui/` 真实交互并人工复核截图。

## 基线

- [中文远程表单的无协议地址](01-baseline-remote-invalid-input.png)
- [提交后焦点回地址框，页面内无说明](02-baseline-remote-invalid-submitted.png)
- [本地未闭合引号的通用提示](03-baseline-local-generic-error.png)
- [展开后看到原技术原因](04-baseline-local-only-technical-diagnostic.png)
- [修正参数后旧错误仍在](05-baseline-local-corrected-old-error.png)
- [正确参数的真实连接](06-baseline-local-corrected-connected.png)
- [唯一真实新增、配置、项目状态与进程](baseline-first-mcp-draft-evidence.json)

## 候选

- [英语远程地址字段提示](07-candidate-remote-error-english.png)
- [同一字段的简体中文提示](08-candidate-remote-error-chinese.png)
- [地址修正后撤下错误](09-candidate-remote-corrected.png)
- [远程配置已保存，默认连接显示需要认证](10-candidate-remote-auth-status.png)
- [简体中文单引号提示及参数焦点](12-candidate-local-single-error-chinese.png)
- [同一单引号错误的英语提示](13-candidate-local-single-error-english.png)
- [编辑参数时撤下旧错误](14-candidate-local-correcting.png)
- [英语双引号提示及参数焦点](15-candidate-local-double-error-english.png)
- [实际修正后的本地连接](16-candidate-local-connected.png)
- [真实表单回执、逐项目配置和状态、远程协议对照](candidate-field-evidence.json)
- [隔离会话、存储与模型活动](candidate-storage-evidence.json)
- [隔离浏览器、连接进程和监听端口的关停](candidate-shutdown-evidence.json)
