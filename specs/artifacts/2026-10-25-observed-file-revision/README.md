# 工具读取事实与文件覆写前置条件

对应[602实施记录](../../records/2026-10/2026-10-25-observed-file-revision.md)。真实开发CLI `http://localhost:54110/ui/`，独立新项目和数据库，普通Node UI沿用600构建，前端源码未改。

- [01-real-conflict.png](01-real-conflict.png)：真实Sol完成3行read后首次write实际返回FileWriteConflictError；模型自然开始重新读取。
- [02-conflict-details.png](02-conflict-details.png)：展开原错误，显示真实冲突、后续4行read及成功write；错误和恢复完整可见。
- [03-recovered-review.png](03-recovered-review.png)：真实Review保留第4行“外部更新：必须保留”，本轮仅追加第5行，摘要与Review均为+1/-0。
- [evidence.json](evidence.json)：原失败/修复后检查、实际read→外部写→write冲突→重新读取→成功提交、模型请求及原始服务结清事实。

外部写入器只在实际read Tool完成并持久化后对自有文件执行一次fs.writeFile，并恢复原mtime；它不伪造消息/结果或阻止模型选择工具。真实业务工具顺序read/completed、write/error、read/completed、write/completed，实际assistant finish=stop。8次真实gpt-6.1-sol请求均streaming，包含预检及后台调用；累计119，未用4次额度退休。凭据及完整模型目录副本已在物理/输出/请求结清后移除，源auth元数据和目录原字节保持。

截图为1280×720原页面，由本agent逐张人工查看，没有裁切/改图、UI自动化或像素断言。折叠错误行的长路径仍占据摘要宽度，完整原因可以展开查看；该呈现问题记录为后续UX改进，不能用它否认本次真实冲突与恢复。跨入口/跨进程最终提交原子性仍需后续审计，本批未宣称完全解决。
