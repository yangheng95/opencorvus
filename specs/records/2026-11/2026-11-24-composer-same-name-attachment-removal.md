# 聊天草稿同名附件的预览与移除

## Recall

用户要求本人独立持续分批调查，先记录根因和影响，再作有证据的修改、真实桌面交互、人工截图复核、聚焦检查与正常推送。`34964d803` 已推送，分支同步，保留 177 项原有工作区状态。本批检查两份原名相同、内容不同的文本文件，验证预览、移除、草稿文字和键盘焦点归属。读过 [界面架构](../../current/architecture/07-panel.md)、[草稿文件阅读](2026-11-12-draft-attachment-reading-height.md)、[附件上传](2026-11-19-attachment-upload-sdk-body.md) 及 [草稿提交接受](2026-11-01-composer-send-acceptance.md)。全仓查 `attachmentDisplayLabel`、`removeAttachment`、`ComposerAttachmentPreview`、`setChatAttachments`、规范上传和原件读取的定义与调用。只使用两个自建项目及两份合成文件。

## 真实桌面结果

- `41770/ui/` 服务提供 `main-DPV2Gw9j.js`。在 `receipt-review` 首页输入草稿，通过页面文件选择器依次添加东区和西区的 `receipt.txt`。两条 `POST /attachment` 分别返回 200。界面同时显示 `1 · receipt.txt`、`2 · receipt.txt`。分别打开，东区正文显示 `E-109` 与 215，西区显示 `W-287` 与 482。关闭均把焦点交还对应的预览按钮，其中西区使用 Escape。
- 用键盘移除东区，列表只留西区文件并显示原名，键盘焦点移至该文件的移除按钮。再次按原名打开，正文仍是西区原文。用键盘移除最后一项，焦点落回输入框，草稿 `Draft: compare the two synthetic receipts.` 保留。原图在取证时人工复核。[截图顺序](../../artifacts/2026-11-24-composer-same-name-attachment-removal/README.md)
- 正式日志记录两条不同原件读取，各 200。对同一路由重新读取并逐字节比较原始文件，两份各 56 字节，都归 `receipt-review`。专用数据库中会话、消息、任务和模型请求为零。关闭本批专用浏览器标签页，通过正常停止接口收尾。该验证未发送消息或调用 GPT-6.1 Sol。[实际请求与原件](../../artifacts/2026-11-24-composer-same-name-attachment-removal/attachment-originals-and-requests.json)

## 根因排查与影响范围

这条路径未复现错误。附件列表保留独立上传引用，临时序号只用于区分可见名称。预览和原件读取使用各自的引用，移除只修改当前草稿的附件列表。键盘焦点交接校验同一次项目选择和草稿身份，再聚焦相邻的移除按钮或输入框。未观察到执行、队列或恢复异常。验收覆盖同一聊天草稿内的两个文本附件、关闭和逐个移除，没有覆盖发送、刷新恢复、跨项目切换或其他媒体。相关公开上传接口与附件容量既有正向测试通过 7 项、32 项断言。无产品代码改动。
