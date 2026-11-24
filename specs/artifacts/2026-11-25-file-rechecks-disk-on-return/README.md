# 返回文件编辑器时的磁盘核对证据

页面运行在独立开发服务，使用自建 Git 项目的文本文件。

- [原始清单](baseline-file-original.jpg)包含 `Confirm the delivery window.`。
- [外部写入周二版并回到文件标签](baseline-file-return-stale.jpg)，界面仍显示原行。[磁盘和服务回执](baseline-external-read.json)确认周二版本已在当前项目可读。
- [显式重载读到周二版](baseline-explicit-reload-finds-current-file.jpg)。从资源管理器双击同一文件时仍为原行，显式重载才读出新版。
- [有草稿时返回文件标签](baseline-draft-file-revisit-stale.jpg)仍有本地输入，[外部写入后的服务回执](baseline-external-read-dirty.json)显示磁盘已是周三版。
- [手动比较确认原草稿和当前磁盘](baseline-compare-confirms-current-disk-and-draft.jpg)。[浏览器发出的实际读取](baseline-file-content-receipts.json)记录初次打开、显式重载、主动比较三笔请求。
