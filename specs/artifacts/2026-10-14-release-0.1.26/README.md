# 0.1.26 整合与发布证据

方案与 Recall：[发布记录](../../records/2026-10/2026-10-14-release-0.1.26.md)。所有日志是本轮真实命令输出，gzip 仅用于保存完整原件，不代表语义测试通过。保留初次失败、错误选择路径和定位时的断言错误，不覆盖为后续成功。

- `integration-tests.log.gz`：整合首轮，包括旧 dispatch 工具预期、orphan 权限结果及误写的不存在路径。
- `legacy-retest.log.gz`：改成真实权限执行后的定位运行；历史事件需按 request_id 而不是只在 requested 行出现的 tool_call_id 关联，本次定位断言仍失败。
- `integration-retest.log.gz`：六个实际后端文件的完整复验，以末尾各文件 exit 和 pass/fail 为准。
- `contract-tests.log.gz`：版本、发布身份/期限/派发、工作流与双语日志等局部契约检查，83 项通过；不冒充原生发布端到端结果。
- `frozen-install.log.gz`：冻结依赖安装的实际输出。
- `generate.log.gz`：唯一生成器刷新专家团 revision registry，源码已是 2026.10.14.1。
- `worktree-inventory.json`：普通合并后的全部 Git 工作树、原 HEAD、ancestry 和各工作树真实 status；主目录当时包含本轮待提交版本准备。
- `fixed-point.log.gz`：已提交 a73080f68 的第二次完整生成，exit0、tracked diff 为空；原缓存保持。
- `push.log.gz`：完整正常 pre-push 与首次 push 回执，origin/main 到 a73080f68，扫描 0 hits；GitHub 原 Rust 告警保留。
- `release-admission.json`：canonical run38546102976 的实际 source、created_at 和 prepare 成功；矩阵当时仍运行，不能当发布完成回执。

v0.1.26 已公开，稳定更新通道与官网下载已完成。原 canonical 联合运行40分钟超时，官网通过既有独立部署补齐；两种结果分开保留。版本资源的真实签名和资产完整性由 canonical workflow 检查，不用可变源码摘要替代行为验收。

- `github-release-public.json` 与 `public-notes-receipt.json`：v0.1.26 正式公开、29 个真实 assets、两种语言正文与原发布 owner/source 完全一致。
- `stable-latest.json`、`version-latest.json`：实际公开下载的更新清单，版本 0.1.26、五个平台；两个不可变/通道交付的 metadata 文件逐字节相等。
- `native-terminal.json`、`paired-website-terminal.json`：原 canonical38546102976 与 child38550642000 的 40 分钟终态；原生已公开，官网未完成，联合运行不能记为成功。
- `public-changelog-{zh,en}.png`、`public-limits-{zh,en}.png`、`public-limits-{zh,en}-complete.png`：真实隐藏隔离浏览器原图，人工复核两种语言的版本正文及限制。第一次底部定位部分内容被导航遮挡，后两张上移后完整复核；不是 UI 自动化测试或截图基线。
- `website-initial-success.json`、`website-recovery-success.json`：原 push 日志部署成功与正式发布后独立官网38551163002的全部8 job成功；后者实际source/c76e8dd02，运行6分51秒。
- `paired-source.log.gz`、`recovery-source.log.gz`：真实source resolve，分别绑定原 native parent/source 与独立网站source；不以GitHub workflow元数据head代替实际checkout。
- `website-downloads-latest.json`、`website-downloads-receipt.json`：真实公开0.1.26下载协议数据；18项按名称、URL与大小对应真实已上传GitHub产物，10桌面/8CLI。
- `public-downloads-zh.png`、`public-download-menu-zh.png`：当前0.1.26首页与展开的桌面安装菜单；第一图仍处于入场动画，第二图为正常菜单视图。`public-menu-scroll-page.png`实际是宿主页面滚动结果，不用于Linux格式视觉验收。
- `worktree-final-inventory.json`：全部工作树最新HEAD已成为origin/main祖先，附加checkout均clean；主目录只剩本轮收尾文档与保留缓存。
