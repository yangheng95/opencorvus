# ACP 历史分页的真实 Windows Zed 验收

## 基线 `d3b27acba`

- [Zed 的历史导入错误](baseline-zed-import-error.jpg) · [实际桌面列表请求和错误回执](baseline-desktop-list.json)
- [公开会话集合、列表边界和最旧会话回放](baseline-runtime.json)

基线截图已人工复核。

## 候选

- [导入窗口取得 104 条](candidate-zed-104-available.jpg) · [实际导入 104 条](candidate-zed-imported-104.jpg) · [搜索到最旧会话](candidate-zed-found-oldest.jpg)
- [从历史打开原会话](candidate-zed-oldest-open.jpg) · [展开同一助手的思考](candidate-zed-oldest-thinking.jpg)
- [两页的真实桌面请求与加载回执](candidate-desktop-runtime.json) · [公开历史、目录范围与原生协议分页](candidate-runtime.json)
- [同一候选网页的项目文件](candidate-web-project-files.png) · [真实原文件内容](candidate-web-review-file.png) · [对应网页请求](candidate-web.json)

候选截图在 2026-11-19 从真实桌面获取并逐张人工复核。协议页分别为 100 加 4 条，主项目的显式目录读取为 100 加 3 条，另一项目单独读取为 1 条。
