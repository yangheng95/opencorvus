# 返回文件编辑器时的磁盘核对证据

页面运行在独立开发服务，使用自建 Git 项目的文本文件。

- [原始清单](baseline-file-original.jpg)包含 `Confirm the delivery window.`。
- [外部写入周二版并回到文件标签](baseline-file-return-stale.jpg)，界面仍显示原行。[磁盘和服务回执](baseline-external-read.json)确认周二版本已在当前项目可读。
- [显式重载读到周二版](baseline-explicit-reload-finds-current-file.jpg)。从资源管理器双击同一文件时仍为原行，显式重载才读出新版。
- [有草稿时返回文件标签](baseline-draft-file-revisit-stale.jpg)仍有本地输入，[外部写入后的服务回执](baseline-external-read-dirty.json)显示磁盘已是周三版。
- [手动比较确认原草稿和当前磁盘](baseline-compare-confirms-current-disk-and-draft.jpg)。[浏览器发出的实际读取](baseline-file-content-receipts.json)记录初次打开、显式重载、主动比较三笔请求。

## 候选

- [键盘返回时读到新正文](candidate-file-return-updates-clean-text.jpg)，焦点留在 File 标签。[外部写入及服务读取](candidate-external-clean.json)确认磁盘为周二版。
- [重新打开同一文件保留原草稿和磁盘变化提示](candidate-file-reopen-keeps-draft-and-notice.jpg)。[第二次外部写入及直接读取](candidate-external-dirty.json)确认磁盘为周三版。
- [条件保存返回冲突并保留草稿](candidate-condition-conflict-keeps-draft.jpg)。[比较面板分开显示新磁盘与原草稿](candidate-comparison-shows-new-disk-and-preserved-draft.jpg)。
- [按现有交互合并并保存](candidate-saves-explicitly-merged-draft.jpg)。[再次返回同一文件](candidate-unchanged-file-keeps-text-and-focus.jpg)和[打开对照文件](candidate-independent-file-opens-its-own-text.jpg)各自显示对应版本。
- [真实浏览器请求和最终磁盘内容](candidate-browser-reads-and-final-files.json)包含此次候选的读取、条件写冲突及成功写入，以及用原路径读取和实际磁盘分别核实的两份文本。
