# Goal读取与项目权限范围

对应[调查与实施记录](../../records/2026-10/2026-10-21-goal-read-project-authority.md)。2026-10-21，单agent。共享权限分类遗漏使Goal GET在读取持久事实前触发完整模型校验；同一真实Chat由400 ProviderModelNotFoundError变为200/null，三类真实旧Goal均恢复读取，执行仍保留原模型校验。没有模型输入或凭据/models复制，没有前端修改或schema升级。

- [实际六项HTTP检查](real-read-check.json)：空Chat、持久Chat/Task/Mission、跨Project409与原runtime400。
- [前](goal-before-http.json)/[后](goal-after-http.json)同owner原响应；[11项聚焦正向合同](focused-tests.log)与[后端类型检查](typecheck.log)。
- [全量原数据保留](data-preservation-observation.json)：90表131156原行、字段/时间/rowid/主键、schema3/integrity、源bytes/mtime、完整canonical；原差异0、Provider activity321→321。[原工具BLOB表示失败](preserve-binary-001.log)与[修复后检查](preserve.log)均保留。
- [before物理结算](before-physical-terminal.json)、[after物理结算](after-physical-terminal.json)：原38166/51039 exit0、公开shutdown200、native物理/output/request/launcher与原出生完整核验。
- prepare/serve/launch/shutdown/settle/check-reads/preserve脚本保留最初498目录名，只读复制完整已结束497源；私有原全库JSON、DB、运行历史未归档。
- [实际凭据值扫描](secret-scan.json)：只用于安全检查，无值输出。本轮没有凭据副本需要删除。

五张人工实页及[保存时间说明](screenshots.json)，均为实际桌面1280×720；文件时间不代表绘制时间，没有截图差分或自动UI测试：

1. [01修改前读取失败](01-unqualified-missing-projection.png)：历史正文可读，Goal报错；原文件名保留，此模型不可用环境是有效数据读取场景。
2. [02同Chat修复后](02-after-goal-readable-model-unavailable.png)：Goal Create可见，模型不可用提示仍保留。
3. [03验收URL错误](03-after-budget-goal-readable.png)：错误使用work体验打开真实chat owner，实际404，不能算Goal读取成功或产品缺陷。
4. [04准确chat路由](04-after-existing-goal-readable.png)：原Goal budget reached、37196/100000 tokens、1/1轮可读。
5. [05原Goal详情](05-after-existing-goal-details.png)：原objective/预算/用量可读，仅查看/关闭。

后台active-intent目录选择导致预算已达Goal在模型不可用时每秒尝试初始化，仍需下一轮完整机制审计；本批未修复。交付成果/持续目标命名、原完整配置性能指标也没有据此宣布达成。长期Goal继续执行。
