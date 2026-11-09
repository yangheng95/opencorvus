# 专家团诊断续页与目录恢复：真实验收

桌面 1280 × 720，真实开发 `/ui`，Windows 隔离项目、配置和服务。本人查看 12 张原始截图。没有运行任何界面自动化测试或调用模型。

| 原图 | 观察 |
| --- | --- |
| [01](01-before-accepted-packages-and-diagnostics.jpg) | 原始状态：扩展包筛选与两条健康安装，诊断总数 22。 |
| [02](02-before-stale-continuation-removes-valid-catalog.jpg) | 实际安装新包后触发旧续页，焦点仍在原操作，而原筛选和安装已从操作下方消失。 |
| [03](03-before-global-error-details.jpg) | 原全页错误与请求关联标识；服务日志确认该请求的游标检查失效。 |
| [04](04-before-full-retry-reads-new-catalog.jpg) | 原顶部重试可取到新安装；手动收起披露后可见原筛选与新安装。 |
| [05](05-after-accepted-packages-and-diagnostics.jpg) | 修复后使用相同的初始目录。 |
| [06](06-after-continuation-failure-keeps-focus.jpg) | 同一真实旧游标失败，只在诊断续页处报错，焦点留在刷新目录。 |
| [07](07-after-original-diagnostics-and-usable-list.jpg) | 展开原请求错误，原筛选和两条健康安装同屏。 |
| [08](08-after-chinese-recovery-action.jpg) | 中文操作、说明、筛选和包来源，原始错误内容保持。 |
| [09](09-after-refresh-accepts-new-installation.jpg) | 键盘刷新接受真实新项目包，焦点仍在已更新的续页按钮。 |
| [10](10-after-new-cursor-opens-correct-diagnostic.jpg) | 新游标读到正确终页，键盘查看缺 README 原因，可用目录仍在。 |
| [11](11-after-opens-new-project-installation.jpg) | 新项目包真实详情，项目选择和生效选择均为 `dynamic`。 |
| [12](12-after-returns-to-exact-new-package.jpg) | 返回准确物理安装行，披露和终页继续可用。 |

[读取检查器](observe-cursor-revision.mjs) 以实际运行文档和实际接口验证 [旧构建初始状态](before-snapshot.json)、[旧构建安装后](before-advance.json)、[新构建初始状态](after-snapshot.json)、[新构建安装后](after-advance.json)。[原始安装](install-owned-payloads.mjs) 与[目录修订推进](advance-owned-catalog.mjs) 只向隔离本地服务安装已验证物理范围的包。前后各三次实际回执（[旧初始](before-installations.json)、[旧新增](before-catalog-advance.json)、[新初始](after-installations.json)、[新新增](after-catalog-advance.json)）。[数据检查器](audit-owned-data.py) 对比物理字节、原项目和数据库，[结果](owned-final-check.json) 保留了实际范围。完整分析见[本批规格](../../records/2026-11/2026-11-09-expert-squad-diagnostics-continuation-recovery.md)。
