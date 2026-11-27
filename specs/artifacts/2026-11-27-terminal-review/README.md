# 真实核对命令的终端记录证据

对应[调查与实施记录](../../records/2026-11/2026-11-27-terminal-review.md)。真实Work读取原sales.csv和53条源清单，执行Python只读核算，发布terminal@1完整原输出。三个修复：Enter复用下一匹配、长命令退出码可见、清除后复制回到完整62行。

- `final-*.png`：7张最终新服务截图，均本人实际查看；`before-*.png`为5张原始发现，`accepted-*.png`为6张中间候选，后者尚未修复清除后的选择复制问题，不能当最终证据。
- `published-terminal.json`、`tool-parts-run64.json`、`publication-facts.json`、`api-artifact-run66.json`：正式工具输入输出、实际命令/退出0、4351字节原输出、53源行及真实产物接口。
- `native-copy*.txt`、`native-selected-copy.txt`：最终两语言/两主题全文复制与选择复制；`before-cleared-copy.txt`是首次候选失败时仅“华东”的真实剪贴板。全文比较按平台换行表示归一。
- `downloaded-terminal.txt`提供可读文本，`native-download.zip`成员保留实际原生下载4351字节/CRLF（Carriage Return/Line Feed，回车换行），`native-downloads.json`记录真实来源。Git文本换行规范化不作为功能门槛。
- `facts-run*.json`、`task-status.json`、`verification.json`：23保护文件/2091旧持久行、SQLite完整性、正式工具终态、12条精确Sol流式EOF（End Of File，流结束）、服务排空/原句柄退出与配对副本退役；类型/构建/CSS/文档仅作辅助检查，不冒充视觉验收。

未新增或运行界面自动化测试；无移动端/外部可执行终端/Office通过声明。凭据、完整模型目录、完整数据库、加密推理及仓外保护基线不进入仓库。服务均正常退出，自有页面关闭。
