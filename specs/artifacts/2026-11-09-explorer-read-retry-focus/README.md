# Explorer 读取重试焦点：实际桌面与请求

本人已人工复核全部实际开发服务截图：

| 图 | 观察 |
| --- | --- |
| [01](01-before-search-error.jpg) | 基线查询 note 的实际错误 |
| [02](02-before-search-pending-retains-retry-focus.jpg) | 基线搜索读取仍待完成时，错误按钮拥有焦点 |
| [03](03-before-search-next-tab.jpg) | 基线按 Tab 后到搜索结果 |
| [04](04-before-search-result-focus-on-body.jpg) | 单独复现基线：结果已显示，尚无控件拥有焦点 |
| [05](05-before-root-failure.jpg) | 基线根读取错误 |
| [06](06-before-root-retry-focus-on-body.jpg) | 根重试成功时还剩独立子错误，焦点落到页面主体 |
| [07](07-before-root-next-tab.jpg) | 基线根重试的下一次 Tab 到第一目录 |
| [08](08-before-child-retry-focus-on-body.jpg) | 基线子目录恢复后，焦点落到页面主体 |
| [09](09-before-child-next-tab.jpg) | 基线子重试的下一次 Tab 到第一目录 |
| [10](10-after-search-error.jpg) | 候选复现同一真实查询错误 |
| [11](11-after-search-retry-keeps-query-and-focus.jpg) | 结果成功后，焦点环与原查询都在搜索栏 |
| [12](12-after-arrow-enters-search-result.jpg) | 按向下键从搜索栏进入现结果 |
| [13](13-after-chinese-root-error.jpg) | 候选中文根读取错误 |
| [14](14-after-root-retry-keeps-explorer-focus.jpg) | 根重试后搜索栏有焦点，真实独立子错误仍显示 |
| [15](15-after-root-tab-follows-toolbar.jpg) | 自然 Tab 进入工具栏的「新建」 |
| [16](16-after-child-retry-keeps-explorer-focus.jpg) | 子重试成功显示空目录，搜索栏仍有焦点 |
| [17](17-after-background-error-keeps-composer-focus.jpg) | 后台读失败，对话输入框保持焦点 |
| [18](18-after-background-recovery-keeps-composer-focus.jpg) | 后台读恢复，对话输入框仍保持焦点 |

[基线](before-observed.json)和[候选](after-observed.json)保存按键时刻和实际可访问状态；[配对审计](owned-request-audit.json)逐条匹配[基线](before-proxy.log)、[候选](after-proxy.log)和真实服务，并核对工作目录及数据库。[代理](directory-scope-proxy.mjs)只改自有项目请求参数；[模式记录](proxy-mode-changes.jsonl)可核对时间范围。

实时接口说明检查：[目录检查器](check-with-archive-tcp.mjs)的[基线初始](before-initial-tcp.json)、[基线恢复](before-recovered-tcp.json)、[候选初始](after-initial-tcp.json)、[候选恢复](after-recovered-tcp.json)，及[搜索检查器](check-search-tcp.mjs)的[查询和类型验证结果](after-search-contract.json)。另有[基线启动](before-startup.json)、[基线关闭](before-shutdown.json)、[候选启动](after-startup.json)及[候选关闭](after-shutdown.json)。
