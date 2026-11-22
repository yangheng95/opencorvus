# 资源管理器完整路径搜索的桌面验收

## 基线

`40416/ui/` 的隔离项目中，北区有 86 个独立文件，南区也有同相对路径的第 86 号文件。文件正文分别属于各自项目。

- [宽查询明确显示首 80 项](baseline-en-broad-search.jpg)
- [同项目完整路径未命中](baseline-en-full-path-no-results.jpg)
- [对应相对路径找到正确文件](baseline-en-relative-path-result.jpg)
- [用键盘打开确切北区第 86 号文件](baseline-en-relative-path-opened.jpg)
- [实际宽查询、窄查询及完整路径读取回执](baseline-search-receipts.json)
- [两个项目中第 86 号文件的实际正文](baseline-file-reads.json)
