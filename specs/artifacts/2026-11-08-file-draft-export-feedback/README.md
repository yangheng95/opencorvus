# 草稿导出反馈证据

对应[调查与方案](../../records/2026-11/2026-11-08-file-draft-export-feedback.md)。输入仅本人临时隔离项目；不使用模型/凭据/产品消息。

input-original.txt、input-draft.txt、input-external.txt 是本批明确原文，payload-input.json 给出自有二进制字节。真实页面、原下载字节和只读观察将在实际操作后登记；没有 UI 自动化测试或 DOM/截图断言。

前态 38946/main-C3zpoJNv.js，1280×720；三张截图均已人工查看：

- 01-before-save-conflict.jpg：真实 PATCH 409、完整原请求身份与保留的草稿。
- 02-before-conflict-actions.jpg：折叠 Details 后可见冲突摘要和反馈内 Compare。
- 03-before-download-retired-conflict.jpg：实际下载 54 字节草稿后，原反馈退休、dirty 和下载键焦点保持。
- before-observations.json：两个真实 409 的请求 ID，以及下载前后的同页只读观察。
- before-initial-read.json / before-external-read.json / before-file-contracts.json：实际 HTTP 200、原文→外部版与真实下载字节契约。
- downloaded-before-draft.txt：浏览器原下载，全文等于 54 字节 input-draft.txt；磁盘仍为 42 字节 input-external.txt。

本人前态页面和服务已正常关闭，原启动句柄 exit 0；实际下载精确移出 Downloads，未扫描或移动其它文件。

最终构建 38947/main-C-qzEdCk.js，1280×720；04–13 均已人工查看：

- 04-after-download-conflict-retained.jpg：实际草稿下载后，同一原冲突、反馈内 Compare、dirty 与下载键焦点保持。
- 05-after-chinese-original-diagnostic.jpg：原地中文，原 PATCH 409/请求 ID 保真。
- 06-after-diagnostic-response-readable.jpg：原生 End 滚动现有 Feedback，原响应正文和比较入口可读。
- 07-after-retained-conflict-comparison.jpg：从保留的反馈入口比较真实磁盘/草稿。
- 08-after-unsaved-decision-conflict.jpg：未保存决定自然显示同一原冲突。
- 09-after-adopt-base-draft-retained.jpg：明确采用基准后旧冲突合法退休，草稿保留、焦点回头部比较。
- 10-after-explicit-save-complete.jpg / 11-after-reopen-saved-draft.jpg：显式 Save 后 clean，再关闭重开完整四行正文。
- 12-after-binary-real-download-failure.jpg：精确自有原件暂移，正文入口真实 404/FileNotFoundError。
- 13-after-binary-retry-success.jpg：原件归位，同页头部入口成功，原下载失败退休、焦点保持。
- after-observations.json：相应实际错误、请求 ID、当前正文、焦点与滚动的只读观察。
- after-initial-read.json / after-external-read.json / after-download-file-contracts.json / after-adopt-file-contracts.json / after-save-file-contracts.json：原文、外部版、54 字节下载、采用不写盘、明确保存后的真实 HTTP/磁盘合同。
- downloaded-after-draft.txt：真实后态浏览器下载，等于 54 字节 input-draft.txt。
- after-binary-initial-read.json / after-binary-file-contracts.json / downloaded-after-payload.bin：真实 metadata-only 读取、12 字节浏览器下载/归位原件/独立 HTTP 200 精确字节。

聚焦现有真实检查器：file-save-conflict 1 测试/32 断言、file-download 11 测试/42 断言，共 12/74 通过；它们是后端真实文件/HTTP/流合同，不是网页验收。typecheck/i18n/最终 build/renderer/docs/architecture 均通过。没有 UI 自动化测试、假消息、请求拦截或模型调用。本人两个页面/服务均正常关闭、原句柄 exit 0，三个实际下载已精确移出 Downloads、二进制原件已归位。
