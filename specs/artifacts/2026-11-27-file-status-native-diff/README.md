# 文件状态原生统计证据

对应[规格与Recall](../../records/2026-11/2026-11-27-file-status-native-diff.md)。本批修正文件状态接口，现有对话审阅原来就正确显示非文本。

- `before-file-status.json` / `before-vcs-diff.json`：同一旧服务真实接口差异；PPTX被旧状态误计55/52/56行，原生VCS统计为0/0。只保留身份/状态/数字，不复制无关配置正文。
- `native-red.log` / `native-green.log`、`source-consumers.log`、`cold-reader.log`、`save-conflict.log`、`error-contract.log`、`link-statistics.log`：6项真实非UI正向测试/76断言，包含真实Git、独立项目、多进程HTTP及命名错误合同。`backend-types.log`为初次精确类型错误，`backend-types-green.log`为修正后的原类型检查。
- `run29-file-status.json` / `run29-vcs-diff.json` / `run29-status-check.json`及`check-current-status.py`：当前源码新服务真实接口一致、6份Office统计与Markdown7行、18文件/1006行历史/原Git索引保留。
- `before-csv.png` / `before-review.png`及`after-csv.png` / `after-review.png` / `after-binary-file.png`：本人真实桌面交互并逐张人工查看；源CSV中文、历史非文本记录、当前只读PPTX名称和16266字节均可读。
- `run28-runtime.json` / `run29-runtime.json`及对应模型请求审计：每次2次精确流式Sol预检，共4次，业务请求0；`verification-summary.json`汇总原句柄退出0、凭据/目录副本退役和端口关闭。

没有UI源码变更或UI自动化。真实Office Edit Data与上批固定渲染器字号单位限制不属于本批接口修复，不宣称解决。
