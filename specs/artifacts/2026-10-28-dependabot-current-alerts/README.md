# 当前告警证据

对应[调查方案](../../records/2026-10/2026-10-28-dependabot-current-alerts.md)。本批修复当前rand告警的真实父依赖：只升级官方tauri-plugin-fs2.4.5→2.7.1，原旧HTML/PHF/rand链随正常Cargo解析退休，622→580节点。没有直接强制rand版本或改写历史取证锁。

- [授权只读原清单](alerts-before.json)：05:24:24Z实际1页8项。#5/#6属于当前Cargo.lock，其余6项属于历史取证。只保留编号/公开包与公告身份，没有凭据内容；没有dismiss、设置或发布写入。
- [父链与公开registry](parent-review.json)、[完整锁节点差异](resolution-nodes.json)、[规范化边差异](normalized-edge-review.json)：fs2.4.5是唯一仍启用utils旧build/html-manipulation的父包；当前Tauri/build/codegen/plugin已使用build-2。唯一新版本是fs2.7.1；43个旧节点退出，Windows依赖在原上游允许范围内重新选择已在锁中的版本。完整原生构建覆盖此实际结果。
- [正式原结果](native-01-result.json)、[原进程结算](native-01-process.json)、[生产21项原输出](native-01-native-contracts.stdout.log.json)、[独立event2项原输出](native-01-event-library-contracts.stdout.log.json)：精确绑定同一正式应用的package、profile和features。新增3项真实SafeFilePath合同及当前PHF0.13确定性查询；退休的PHF0.10/0.11专用测试与extern同步替换，没有借旧库使测试继续通过。
- [普通完整构建stdout](canonical-build-readable.stdout.log.json)、[stderr](canonical-build.stderr.log.json)：正常build:overlay、SDK、两次普通Node/Vite及Windows release成功，实际打包后端创建4会话、重启保留2，realProvider=false。构建只校验内存schema9。没有用户数据库、auth副本或模型请求；新增模型0/累计759。
- [Overlay JSON审计](overlay-json-cache-recheck.stdout.log.json)与[完整terminal审计](overlay-terminal-cache-complete.stdout.log.json)：官方1380条公告，580依赖，0漏洞/7警告；包括glib0.18.5不健全、4项维护警告及2项yank。对应stderr和原结果均在本目录，无过滤参数；没有把0漏洞叫作无安全问题。
- [Supervisor JSON审计](supervisor-json-current.stdout.log.json)与[terminal审计](supervisor-terminal-current.stdout.log.json)：22依赖，0漏洞/0警告，真实更新数据库与registry。
- [汇总](runtime-review.json)：21+2合同、首次运行、全部审计命令和原物理/输出结算，原40分钟截止前余量1759835ms，单文件类型检查及351操作/26组文档检查通过。

所有.log.json以UTF-8原样content保存。构建stdout仅省去携带reason的Cargo JSON行；完整stdout/实际compiler-artifacts保留在忽略的本轮输出，读取版的限定已写入文件。未复制PKI私钥、可执行文件、PDB或凭据。首轮terminal的registry超时、gtk索引地址404、两个私有TypeScript类型定位失败原件保留，随后修正工具前提并重跑成功，详见方案。

未验收：原生GUI/实际文件选择对话框、Linux/macOS执行、真实更新安装和所有攻击配置。当前glib父约束仍为GTK^0.18，不能将新GTK0.19/glib0.22直接塞入同一ABI家族；glib告警与历史6项继续保留。当前页面代码没有修改，没有新增或运行UI自动化，不把上述库合同和构建当视觉验收。
