# 附件上传的公开 SDK 接收原始文件请求体

## Recall

- 用户要求本人持续分批调查、先完成根因和影响分析并落盘，再实现、真实 Windows 桌面页面交互和截图人工复核、聚焦正向检查、范围提交、上游合并及普通推送。明确不用子 agent。本批为第 320 批，第 319 批 `6827d128b`、`293772511` 已推送，分支同步，177 项原有工作区状态一致。
- 已读 `AGENTS.md`、当前扩展、数据和界面架构中的附件入口、`AttachmentRoutes`、生成 SDK（Software Development Kit，软件开发工具包）的完整附件方法及类型、Fetch 客户端请求体处理、SDK 事务生成脚本、界面原始字节上传、原件下载测试、全局流传输路由及文档生成器。全仓搜索 `attachment.create`、同语义上传调用与所有服务器路由的原始字节读取。只有本路由直接读取 `c.req.arrayBuffer()`；同名 Channel 入口有 JSON（JavaScript Object Notation，结构化数据格式）校验合同，全局流传输已声明请求体，项目文件上传使用现有结构化输入，均不是本次缺失。
- 对照已安装 `@hey-api/openapi-ts` 0.97.3、[官方 Fetch 客户端文档](https://heyapi.dev/docs/openapi/typescript/clients/fetch)和隔离生成试验：在现有操作中声明必填的 `application/octet-stream` 二进制请求体，生成器自然产生 `body: Blob | File`、原始请求体绑定及 `bodySerializer: null`。不需要手改生成产物或新建上传实现。试验首次使用 CommonJS（传统模块系统）解析器无法解析只提供 ESM（ECMAScript Modules，标准模块系统）入口的依赖，已按实际安装的入口修复试验并重跑成功，不是产品依赖缺失。
- 验收要求：生成的公开 SDK 可上传含非文本字节的文件、零字节文本和真实 PNG（Portable Network Graphics，便携式网络图形），默认通用媒体类型与显式媒体类型均正确，实际原件字节和原名可核对。真实开发页面显示对应附件并实际下载；非 UI 改动采用实际 SDK、HTTP（Hypertext Transfer Protocol，超文本传输协议）和附件存储正向检查。使用自有本机流式 `acp-review/local`，无外部凭据或 GPT-6.1 Sol 调用，不新增或运行 UI 自动化。

## 现象、根因及影响

真实基线服务 `40112` 中，将 `Blob` 放入公开 `attachment.create` 的常规 `body` 参数并提供明确媒体类型，31 字节二进制文件、零字节文本和 100 字节 PNG 全部得到 HTTP 400，错误为 `Attachment upload requires Content-Type`。同一服务的实际原始 HTTP 对照全部得到 200，分别保存 31、0、100 字节。不是服务器拒绝空文件或附件存储故障。[基线请求及对照](../../artifacts/2026-11-19-attachment-upload-sdk-body/README.md)

根因是 `POST /attachment` 的运行处理器接收原始请求字节，但其 OpenAPI（开放接口描述规范）没有请求体声明。SDK 因而生成 `AttachmentCreateData.body?: never`，方法只绑定目录与文件名，忽略调用者给出的 `body`。共享客户端看到真实请求体为 `undefined`，按现有正确规则去掉媒体头，所以服务最终报告缺少 `Content-Type`。最后的错误是字段遗漏的结果，不是应修改请求头清理器的理由。现有网页通过自己的原始字节 HTTP primitive 上传，因此之前的网页验收没有覆盖这个公开 SDK 缺口。

影响是 OpenAPI 的单一操作定义、公开 SDK 的请求体类型、方法绑定和媒体序列化，以及使用该 SDK 的外部调用者。修复以同一路由的声明为事实来源，官方生成过程同步产物。服务器处理器、现有界面上传、原件路由、权限、项目隔离、附件持久格式及数据库结构均不改变，无需迁移。零字节文件仍用明确的空 `Blob` 表达，不能把缺失参数当作有效输入；具体 MIME（Multipurpose Internet Mail Extensions，互联网媒体类型）仍由当前媒体头给出，SDK 默认使用通用二进制类型，显式类型可通过现有请求选项提供。风险是生成器对原始二进制的序列化、空文件媒体头被错误剔除，以及默认 JSON 序列化损坏真实非文本字节。无调度、并发、恢复或终态异常。此前 ACP（Agent Client Protocol，编辑器客户端协议）的零字节嵌入资源问题仍是另一输入合同，本批不宣称已经解决。

## 实施与验收

给现有路由补全必填二进制请求体，保持原字节处理器不变。运行 `bun run --cwd packages/sdk/js build` 事务生成当前 SDK，审查完整差异，运行现有文档生成与检查。新增正向检查通过真正的 SDK 方法和 HTTP 服务上传原始二进制、空文本及 PNG，核对规范引用、类型、原名、长度和实际下载字节；验证普通 SDK 调用能够通过类型检查，不用类型逃逸或自定义序列化器让检查通过。

新建隔离候选服务 `40114/ui/`，使用 SDK 的原始上传输出向真实对话提交原始附件。检查网页文件名、文本及图片入口，实际下载并逐张人工复核，核对实际本机模型的流式请求及图像字节，不把模拟参与者的回复当作文件正确性的证据。运行聚焦上传、下载和有关附件输入检查、SDK 与后端类型、文档、路由和架构索引，完成范围提交、上游合并和正常推送后继续下一批。
