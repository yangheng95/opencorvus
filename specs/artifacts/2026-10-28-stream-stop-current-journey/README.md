# 当前停止与继续实页证据

对应[方案](../../records/2026-10/2026-10-28-stream-stop-current-journey.md)。只用一个代理，开发CLI /ui、真实gpt-6.1-sol流式请求和原始截图人工复核。

- [01](01-before-stop.jpg)：当前旧构建真实正文输出中，Composer Stop可操作。
- [02](02-after-stop.jpg)：实际停止后正文保留、输入恢复，但已停止说明缺失；原API有完整取消事实。
- [03](03-stopped-english.jpg)：新普通构建读取同一原消息，英文Stopped及Details正常。
- [04](04-original-cancellation-details.jpg)：展开原MessageAbortedError、user/session.abort及实际请求/Session身份。
- [05](05-stopped-chinese.jpg)：中文已停止、复制停止详情和详细信息；保留当时Settings tooltip。
- [06](06-chinese-original-details.jpg)：中文详情最终完整可读，原错误/取消事实保持。

[取消事实](cancellation-facts.json)将人工Stop时点、索引7的原reader Error及持久MessageAbortedError精确关联；其余七个reader为EOF。8次实际请求包含预检、记忆与工具/正式回复轮次；未扩额，累计755。后续付费发送、改后再次实际Stop、成员会话与剪贴板内容没有本批资格，不宣称通过。

[原运行收尾](retirement.json)、[改后收尾](retirement-after.json)保存原exec/native/launcher、物理/输出/请求、公开shutdown200、精确进程身份和来源保持。auth一份及catalog两份均在结清后退休，改后0模型请求，不操作用户服务或数据库。

[数据保留](data-retention.json)：原来源98294行保持，755原98292行精确相同，两项已过期容量槽由实际67792复用并释放；改后100279行完全保留、最终100281行，schema9/integrity ok，三个输入文件保持。[检查](checks.json)包含普通构建、类型、文档和架构索引原进程结果；它们不替代六张人工查看原图。没有UI自动化测试、迁移、版本或发布变化。
