# 文件公开错误合同证据

对应[调查与验收](../../records/2026-11/2026-11-08-file-api-error-contracts.md)。本人fresh项目/输入；零模型/凭据，产品运行逻辑与UI保持。

- `before-http-contract.json` / `after-http-contract.json`：真实TCP请求/ID/body、各自公开response schema和Ajv改前拒绝→改后接受；after另记录运行协议/生成协议比较边界。
- `01`—`04`：before英语409原Details、中文同ID与再次New成功打开空文件。
- `05`—`07`：after相同真实错误恢复路径的中英文手工截图；全部7图均实际呈现并人工查看。
- `before-explorer-error.txt` / `after-explorer-error.txt` / `*-ui-observations.json`：真实原Details/当前文件/实际bundle，非合成UI消息。
- `*-current-file-bytes.json`：原33/17bytes输入和新0bytes文件、after实际公开200内容。
- `after-io-error-contract.json` / `after-io-error-diagnostics.json`：真实EBUSY/open→Unknown500原诊断及schema通过，helper释放后恢复。
- `generated-semantic-diff.json`：13项operation、9个原错误Schema、完整inventory和其它components稳定。
- `sdk-consumer-contract.ts`：已通过严格编译的生成SDK正向缩窄示例；不产生产品请求。
- `checker-framework-probe.json`：Bun当前nested asymmetric matcher改写样本的独立工具证据，新测试已改用具体类型断言并重跑原验收。
- `acceptance.json`：真实Hono/FS/Git/Ajv聚焦checker、TCP、UI、生成/类型/文档检查及已验/未验/资源正常退出。

Hono局部测试不称TCP/桌面E2E；G500实际经Hono/真实Git输入验证，普通IO500另有真实TCP/Windows读锁。完整运行doc/build日志仅Temp；正式生成含CLI x-codeSamples，协议比较仅分离该已定义展示扩展。没有源码摘要或UI自动化充当验收。
