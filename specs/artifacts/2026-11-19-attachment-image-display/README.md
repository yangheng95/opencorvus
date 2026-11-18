# 按发布媒体显示图片验收

第 325 批，2026-11-19，本人独立调查。见[根因、影响及实施前规格](../../records/2026-11/2026-11-19-attachment-image-display.md)。仅隔离本机流式参与者，不使用外部模型、凭据或子 agent。

- [真实公开上传、原件及派生输出、真实会话](baseline-runtime.json)
- [本人所见：三个正常缩略图](baseline-three-thumbnails.png)
- [本人所见：SVG `.dat` 完整预览失败](baseline-svg-dat-full-failed.png)
- [本人所见：SVG `.png` 完整预览失败](baseline-svg-png-full-failed.png)

原字节/媒体回执正确，两个服务端图像规格均实际 200 且可解码，前两件的完整预览因后缀选择原件而失败。实际对话正常 stop，基线服务正常退出 0。

候选由服务端根据已验证发布媒体选择 `image-display`，SVG 使用既有完整 WebP，光栅保持原字节/尺寸。17 项后端正向检查、180 断言、5 文件通过；正式 SDK 生成、前后端/协议/SDK 类型、两语言 3229 键、样式、前端构建/渲染器、353 操作文档、36 文件路由和 20 文档架构检查通过。已删除检索到的 4 项预览 UI 状态自动检查且未运行。

- [候选公开上传、原件/两个规格/新显示表示及真实会话](candidate-runtime.json)
- [三张候选缩略图](candidate-three-thumbnails.png)
- [SVG `.dat` 英文完整预览](candidate-svg-dat-full-en.png)
- [SVG `.png` 英文完整预览](candidate-svg-png-full-en.png)
- [PNG `.svg` 英文完整原图](candidate-png-svg-full-en.png)
- [实际切换中文后重开 SVG](candidate-svg-dat-full-zh.png)
- [中文操作菜单](candidate-svg-actions-zh.png)
- [实际浏览器资源响应](candidate-browser-responses.json)：两个 SVG 显示为 WebP 4960/4776 字节，PNG 显示为原始 PNG 17078 字节
- [三次实际原件下载](candidate-browser-downloads.json)：原名 349、349、17078 字节，均与源文件逐字节一致
- [基线最终只读库](baseline-persistence-final.json)、[候选最终只读库](candidate-persistence-final.json)
- [基线媒体回执](baseline-published-metadata.json)、[候选媒体回执](candidate-published-metadata.json)
- [4 次精确本机流式请求与完成](model-stream-events.json)、[最终检查和自有服务退出](final-validation-summary.json)

所有目标截图均由本人实际呈现并逐张查看，未以资源响应或自动断言替代视觉验收。两库均 1 会话、2 消息、8 部件、3 文件部件、提示所有权 0，轮次正常 stop。两自有 ACP 服务和模型退出 0，Chrome 正常关闭，40142/40144/40146 已关闭。无外部模型、凭据或剪贴板操作；模型仅为自有脚本参与者。SVG 显式完整派生规格仍有既有 4096 上限，光栅显示保持原始尺寸；历史媒体恢复和网页角色加载仍为独立调查。
