# 清除项目代理后的继承回执证据

两套真实开发服务通过正常配置路由写入各自的本机测试配置。两个用途均关闭，没有实际代理连通测试。所有截图均经本人操作及查看。

| 图 | 真实页面观察 |
| --- | --- |
| [01](01-before-project-override-is-effective.jpg) | 基线有效项目覆盖 31299 |
| [02](02-before-cleared-proxy-input.jpg) | 实际清空地址，准备保存 |
| [03](03-before-clear-saved-but-inherited-address-returns.jpg) | 地址回到 31298，仅显示 Saved |
| [04](04-after-project-override-before-clear.jpg) | 改后同一初始覆盖 |
| [05](05-after-clear-explains-inherited-value.jpg) | 回执说明覆盖已清除且值来自继承 |
| [06](06-after-same-receipt-localized-in-chinese.jpg) | 原地中文，继承事实保持 |
| [07](07-after-new-project-draft-retires-receipt.jpg) | 新草稿 31300，原说明退役 |
| [08](08-after-explicit-project-override-saves-normally.jpg) | 显式项目覆盖正常已保存 |

[基线观察](before-observed.json)及[改后观察](after-observed.json)。[检查器](check-proxy-inheritance-tcp.mjs)用实际服务契约验收：[基线初始](before-seed-tcp.json)、[基线继承](before-inherited-tcp.json)、[改后初始](after-seed-tcp.json)、[改后继承](after-inherited-tcp.json)、[改后重新覆盖](after-override-tcp.json)。两边清除后配置文件的原值见[基线](before-inherited-disk.json)和[改后](after-inherited-disk.json)。[原项目](seed.json)、[核对脚本](audit-owned-inheritance.py)与[结果](owned-final-check.json)覆盖持久状态及真实写入编号。[39123](before-startup.json)和[39124](after-startup.json)均已正常关闭。
