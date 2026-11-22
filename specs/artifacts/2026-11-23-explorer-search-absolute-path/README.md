# 资源管理器完整路径搜索的桌面验收

## 基线

`40416/ui/` 的隔离项目中，北区有 86 个独立文件，南区也有同相对路径的第 86 号文件。文件正文分别属于各自项目。

- [宽查询明确显示首 80 项](baseline-en-broad-search.jpg)
- [同项目完整路径未命中](baseline-en-full-path-no-results.jpg)
- [对应相对路径找到正确文件](baseline-en-relative-path-result.jpg)
- [用键盘打开确切北区第 86 号文件](baseline-en-relative-path-opened.jpg)
- [实际宽查询、窄查询及完整路径读取回执](baseline-search-receipts.json)
- [两个项目中第 86 号文件的实际正文](baseline-file-reads.json)

## 候选

`40418/ui/` 使用相同项目和原文件验证完整路径、范围及键盘操作。

- [宽查询仍提示首 80 项](candidate-en-broad-search.jpg)
- [英文用完整路径找到原第 86 号文件](candidate-en-full-path-result.jpg)
- [英文键盘打开确切北区文件](candidate-en-full-path-opened.jpg)
- [简体中文界面输入带引号的原生完整路径](candidate-zh-quoted-absolute-path.jpg)
- [北区搜索南区完整路径时的当前范围](candidate-zh-other-project-scope.jpg)
- [切到南区后，同一输入命中实际文件](candidate-zh-south-full-path-result.jpg)
- [键盘真正打开南区原文件](candidate-zh-south-full-path-opened.jpg)
- [正式查询和两个源文件的精确回执](candidate-search-and-file-reads.json)
- [文件样本与两套隔离数据库实际计数](isolated-runtime-and-source-counts.json)
