# 原始文件目标与原生编辑器证据

[Recall、根因与完整验收边界](../../records/2026-10/2026-10-14-literal-file-targets.md)。全程单开发agent；原始路径在前端交付、原生编辑器入口和Windows启动中保持同一身份，启动失败继续报告原错误及程序标识。

修前两个TypeScript主机合同共5个literal输出失败；修后browser/tauri矩阵共16项29断言通过。这些是纯命令/数据合同，未生成DOM或运行UI自动化测试，不能替代页面或真实IDE验收。

checks/rust-before.log.gz和rust-before-argv.log.gz保存生产命令的真实失败：C:/repo/A&B/reference.md:3:15被原cmd包装截成argv=["--goto","C:/repo/A"]，B被解释成另一个命令，status=1。修后rust-final.log.gz为4项正向Rust合同：五类受控编辑器×六个实际路径共30个真实子进程，原argv/退出0/output join保留；另在隔离进程验证缺少launcher映射NotFound。前后均调用同一生产ProjectEditor命令工厂；不是静态字符串比对。受控cmd/exe只记录argv，没有启动用户IDE。

| 真实原图 | 结果 |
| --- | --- |
| [01](ui/01-real-source.jpg) | 实际Sol主会话search_code返回末尾NBSP文件的真实Source |
| [02](ui/02-literal-file-open.jpg) | 点击后内置文件工作区打开IDENTITY_LITERAL_NBSP_422，定位第1行；另一普通同名文件内容不同 |

两图人工查看。该普通Source/workbench路径原本正确，本次为共享路径改动后的真实回归；**不是原生厂商IDE窗口验收**。Mac/Linux及厂商IDE内部加载/行列位置未实际验收，Native成功结果仅是进程交接回执。CLI需要实际安装并可通过其声明名称启动；错误进入现有本地化反馈，不降级为无位置打开。

facts/final.json.gz是已有单主会话的canonical只读数据及实际ToolOutcome输出；material.json.gz保存两个实际文件原文、尾NBSP路径与其可见转义注释。原始事实未改写，数据库仍版本2。provider-summary和native最新原件共5条实际gpt-6.1-sol流，全部HTTP200/settled/eof。ui/native保存真实预检、公开shutdown、physical/output/request及配对退休；原启动53001正常exit0，页面3关闭。

before保存改前源码原件，checks保存原失败、最终检查、Node构建（含警告）与准备/归档脚本，不含凭据或二进制。421虚拟剪贴板限制仍明确未闭合，未用期望值写入虚拟剪贴板冒充完整粘贴。标准库行为依据：[Rust进程文档](https://doc.rust-lang.org/std/process/#batch-file-special-handling)、[官方安全说明](https://blog.rust-lang.org/2024/04/09/cve-2024-24576/)；功能结论依据本目录真实命令和页面事实。
