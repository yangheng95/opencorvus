# 模态 Dialog 归还焦点证据

遵循[实施前Recall/根因与交付记录](../../records/2026-10/2026-10-22-dialog-opener-focus.md)。通用Dialog未提供Kobalte Trigger，库的默认modal关闭归还空目标，Goal三条关闭后均落BODY。修复在唯一Dialog保留真实opener，并尊重现有调用方preventDefault及新焦点所有权。

01—10为before19033/IAB132，11—20为after19035/IAB133，20张均实际呈现并人工查看。02/04/06是Esc、Close、外部点击后的BODY；12/14/16分别回原Create goal，13是在Esc归还后直接原生Enter重开。07—10/17—20对照命令面板原搜索按钮与编辑框热键的专用归还处理；没有执行命令或创建/运行Goal。

`before-console-*.json`是被动callback观察，不修改焦点或状态，累计24条DF531生命周期记录，不等于24次关闭。`before/after-manual-observations.json`记录交互后的实际焦点；这些是人工实页证据，不是DOM自动化断言测试。`result-observation.json.gz`、`resource-summary.json`包含已交付assets、浏览器/运行日志分类、20实图及资源边界；两个服务各11条ModelNotFound/config传播error来自无模型隔离配置，不能说console clean或Provider成功。

原service53032/66127均join exit0/public shutdown200/native physical/output/request/launcher闭合，精确出生链dead_or_reused；132/133已关。最大/实际模型0/0，无auth/catalog复制。两份源与目标90表158027原行/所有身份字段时间保持，Provider activity395→395、schema3实际对象/integrity/完整canonical/source bytesmtime保持，见`data-preservation-observation.json.gz`。完整DB/全行快照不入库。

helper原执行位置为仓库`.tmp-product-iteration/dialog-opener-focus-531/`，依赖现有413/446原生监督、497固定Bun及成熟零模型准备链，归档路径不是独立可执行发行包。`build-diagnostic.mjs`针对父b161e40d0，仅before被动观察；after使用无诊断正式Node构建main-DwFFu1Lg.js。`scan-final.mjs`只读源auth做实际值扫描，不输出实际秘密，不为服务复制凭据。

限制：没有Goal提交/执行或新LLM资格；FileEditor脏文件hook仅代码复核；原节点无效或其他焦点接管的守卫未制造夹具验证；本轮未重做modal Tab循环。用户18571未操作，Sources/Rendering根因不因本批而声明完成。
