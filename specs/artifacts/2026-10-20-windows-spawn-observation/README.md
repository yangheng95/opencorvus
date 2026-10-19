# Windows spawn 原始观测

447仅调查，不改变生产源码。见[Recall及分析](../../records/2026-10/2026-10-20-windows-ffi-binding.md)。

- `before-samples.json`：真实进程身份/Job与独立Rust oracle，FFI绑定成本不足以解释19秒。
- 四个`*-samples.json`：Bun/Node交错，各24个原leaf命令及完整输出关闭，均exit0。
- `spawn-observations.json`与`spawn-summary.json`：原完整服务682次实际spawn，被动观测0丢弃；冷写窗口388次、同步累计10.05秒，恢复窗口80次、同步累计1.72秒。并发页面命令可能落入同一时间窗口，不推断独占归因。
- `observed-cost.json`：完整80 Project请求的实际阶段；累计并发阶段不是墙钟。
- `results.json`：实际gpt-6.1-sol流式预检、完整canonical恢复、两次原occurrence的失败与物理结算，最终原launcher/checker退出0。原10s/5s性能仍failed；composer references读取22.43秒也未达20s标准。
- `after-chat.png`保留保存期间的真实短暂模型错误；`observed-home.png`是手动交互后的默认页与Goal入口。没有运行UI自动化测试，也不声称该错误已修复。
- `data-verification.json`：原生退出后直接只读SQLite，schema2、80 Projects；未初始化或清库。
- `private-pair-retirement.json`：runtime/private复制的auth/models对在原物理结算后退休，源授权metadata未改变；实际敏感值已扫描。

这些插桩数据定位同步阻塞，不能替代未插桩验收。下一轮继续根因修复与原完整checker。
