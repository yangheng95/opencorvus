# Windows 监管标准管道测量

单agent第454轮，见[Recall、方案与决定](../../records/2026-10/2026-10-20-windows-supervised-stdio.md)。仅scratch替换标准stdio参数，生产实现保持pipe。

- `measurements.json`、`measure.log`：原Process.runHost和Rust helper执行144条真实Git、4条大stdin/stdout/stderr命令；所有命令通过明确路径、字节和实际close合同，监管live=0。
- `prepare.ts`、`measure.ts`、`payload.mjs`：原只读输入准备及诊断执行代码，绝对路径绑定本次自有scope，不能当作通用运行入口。
- `measure-first-error.log`：首轮所有命令完成后，scratch汇总方法名错误的实际exit1；修正后第二轮完整结果保存。第二轮最终数值exit观察在上下文边界丢失，原句柄88569已退休，不伪称观察到exit0。
- `settlement.json`：原句柄与数据边界。输入98 Project/schema2，诊断仅选24个本地Git，不能代替完整配置性能验收；新runtime只有cache/version，没有数据库或凭据。

串行pipe/overlapped为3485/3615ms；两组并发12的pipe为1394/1714ms，overlapped为1701/1756ms；大输出pipe为161/171ms，overlapped为218/179ms。没有稳定收益，拒绝生产替换。没有新的UI、Provider或全量配置验收，也没有修改用户数据或schema。
