# 读取路径拒绝证据

对应[方案与调查](../../records/2026-11/2026-11-09-file-read-path-errors.md)。本人独立使用自有项目/外部自有原文，正式正向checker、真实TCP与隔离页面人工截图复核；零子agent、模型、凭据与UI自动化。

- 01/02：外部自有链接原加载失败页面与500/UnknownError原Details。
- 03：范围内链接原文成功。
- 04/05：原拒绝页面的实际400/FileInvalidPathError、原逻辑path和拒绝文本。
- 06：中文加载/重试提示，原技术诊断保持。
- 07：自有链接临时指向范围内目标后，真实重试成功；关闭页面后恢复原外部目标。
- before-tcp-and-bytes.json：四项原500、两项正常200、39/26/48/28原字节。
- after-tcp-protocol-bytes.json：四项具名400与正常/404输出；原文/原链接恢复；352操作仅两个400变化、共享schema/正式SDK一致。
- tcp-schema-check.json：9次Node.js Ajv2020直接真实TCP/doc/响应校验。

7张截图已逐张实际呈现并本人查看。71pass/703正向断言、类型/SDK/必要包/正常UI构建/文档辅助检查通过。UI源码未改，普通加载失败标题保持；未声称新增专用拒绝页。页面62/63关闭、服务42429/12486正常shutdown和原session退出0；零模型/凭据，授权未收到。
