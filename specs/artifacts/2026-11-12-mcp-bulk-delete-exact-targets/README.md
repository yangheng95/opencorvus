# 批量删除确认、真实回执和精确名称

本人使用隔离有头 Chrome 对项目开发服务的实际 `/ui/` 做指针和键盘交互，并人工复核截图。持久定义、连接状态和进程由真实服务产生。

## 基线

- [主项目删除框](01-baseline-primary-bulk-delete-confirm.png)
- [同名第二项目的连接列表](02-baseline-alternate-connection-list.png)
- [第二项目的相同删除框](03-baseline-alternate-bulk-delete-confirm.png)
- [有实际本地连接的删除确认](04-baseline-live-delete-confirm.png)
- [真实回执等待时的界面](05-baseline-bulk-delete-pending.png)
- [收到完整回执后的空列表](06-baseline-bulk-delete-empty.png)
- [真实请求、两个项目的配置及进程退出](baseline-mcp-delete-evidence.json)
- [空白名称被改变后的实际请求和配置](identity-mcp-exact-names-evidence.json)

## 改后

- [主项目英文精确确认](08-candidate-primary-confirm-english.png)
- [取消后焦点返回和原项目连接](09-candidate-primary-cancel-return.png)
- [第二个同名项目英文精确确认](10-candidate-alternate-confirm-english.png)
- [第二项目中文确认和完整路径](11-candidate-alternate-confirm-chinese.png)
- [键盘聚焦明确删除按钮](12-candidate-alternate-confirm-focused.png)
- [实际等待回执时的焦点](13-candidate-alternate-delete-pending.png)
- [完成后空状态和焦点](14-candidate-alternate-deleted-focus.png)
- [带空白和空名称的真实确认](15-candidate-exact-name-confirm.png)
- [实际精确删除后保留规范名](16-candidate-exact-name-remaining.png)
- [主项目两条连接保持原状态](17-candidate-primary-preserved.png)
- [真实请求、进程退出和两个项目状态](candidate-mcp-delete-evidence.json)
- [逐个精确名称的正式接口与持久配置](candidate-mcp-exact-names-evidence.json)
- [隔离数据库检查](candidate-storage-evidence.json)
- [隔离服务关停回执](candidate-stopped.json)
