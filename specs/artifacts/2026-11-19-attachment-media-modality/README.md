# 附件媒体与模型模态证据

方案与根因见[本批记录](../../records/2026-11/2026-11-19-attachment-media-modality.md)。

- baseline-runtime.json：五份真实上传及字节对照、六个真实会话、实际消息和官方 ACP 回放。
- baseline-model-stream-events.json：本机服务接到的真实流式请求，单文件与合并输入的图像 MIME/字节数，不能以页面可见或 stop 冒充图像传入。
- baseline-five-images.png：本人真实桌面看到五张图片均正确。
- baseline-capitals-full-image.png：本人实际打开大写媒体声明图片，100% 全图正确；失真发生在其他消费者投影。
- [候选实际用户/工具链](candidate-runtime.json)、[重启后协议及工具链](candidate-restart-runtime.json)、[最终网页及续问](candidate-final-web-runtime.json)：五图模型输入、完整原声明、真实 MCP 调用和重启后历史投影。
- [实际模型请求](model-stream-events.json)：57 次流式传输完成；最后一次历史续问的五份 PNG 与已知原件逐字节相同。
- [最终检查](final-validation-summary.json)、[基线持久事实](baseline-persistence-final.json)、[候选持久事实](candidate-persistence-final.json)：105 项聚焦测试通过，两个真实原下载保留 343/348 字节，所有者为零、本人端口关闭。
- candidate-five-images.png、candidate-vector-full-image.png：本人查看候选缩略图和用户原件全图。
- candidate-web-tool-first-image.png、candidate-web-tool-raster-images.png、candidate-web-tool-svg-images.png、candidate-web-tool-vector-full-image.png：本人真实展开工具，滚动复核全部五图，并打开参数 SVG 全图。
- [未分配服务的网页失败](candidate-web-tool-runtime.json)、[仅 ACP 附加后的目录](candidate-web-tool-restored-runtime.json)、[显式项目分配后的成功](candidate-web-tool-assigned-runtime.json)：真实失败及后续恢复完整保留，不将连接/附加当作固定 Chat 的能力分配。生成 SDK 原型参数错误修正后重新运行成功。
- zed-candidate-acp.jsonl 是首次候选的官方协议传输记录。这里只证明实际协议、数据和桌面运行；本机未验证工具图像传输的适配器保留明确限制，不宣称外部模型、GPT-6.1 Sol 或 native Zed 验收。
- 首次推送的通用包测试字面量类型错误及独立修正重跑见最终检查中的 postCommitCheckCorrection；生产代码和图像字节验收未变，钩子按原流程重跑。
