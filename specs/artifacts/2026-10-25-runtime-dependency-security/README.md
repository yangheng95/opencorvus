# 运行依赖安全与实际网站验收证据

对应[调查与方案](../../records/2026-10/2026-10-25-runtime-dependency-security.md)。当前单agent完成；未启动LLM请求或子agent，未操作18571或真实用户数据库。所有checker使用隔离目录与固定Bun1.4.0，UI仅作真实开发页面交互、截图和人工复核。

- `verification.json`：原checker退出、物理/输出结算及告警变化；不把失败或仅打印帮助的命令当成验收。
- `audit-before.json` / `audit-after.json`：真实Bun审计，保留传递依赖的剩余问题；不是全量安全归零。
- `response-before.log` / `response-after.log`：真实Node HTTP/代理故障及修复后错误、后续stream与资源关闭合同。
- `datetime-before.log` / `datetime-after.log`：升级默认值导致分钟精度拒绝的实际失败与当前合同修复。
- `runtime-before.log` / `runtime-after.log`：正式编译控制程序原生加载失败及共享声明/执行边界修复后的HTTP、SQLite、归档字节与计数检查。
- `api-schema-review.json`：完整生成差异调查的结构分类与当前公开数据合同说明；不能代替实际routes/typecheck验收。
- `website-host-settled.json`：自有Astro开发进程主动关闭后，原生产ProcessFacade/Windows Job的真实终态与双输出排空。

人工查看的桌面截图：

- `market-single-before.png` / `market-single-after.png`：同一真实搜索的一项结果从“1 teams”修正为“1 team”。
- `market-many-after.png`：12 teams，卡片为1 workflow。
- `market-empty-after.png`：实际英文零结果空状态。
- `market-zh-after.png`：中文计数、搜索和卡片。
- `site-zh.png` / `site-en.png` / `market-detail-after.png`：Astro升级后的真实首页语言切换和Registry详情。它们不证明所有页面、DOMPurify特殊模式或签名下载已经覆盖；本地未签名目录仍明确拒绝下载。

原高频成员侧栏Rendering根因仍未在本批解决。历史资料、默认页面及Goal改善不因本阶段安全补丁宣称完成；继续沿原Goal调查。未发布产品版本、Release、tag或部署网站。
