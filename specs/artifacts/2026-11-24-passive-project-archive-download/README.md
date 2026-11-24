# 项目交付包下载的桌面证据

基线 `41710/ui/`，正式入口文件 `main-DPV2Gw9j.js`，1280×720 实际桌面。

- 受保护项目从工作记录行的下载菜单返回 500，真实错误弹窗含请求号。[失败详情](baseline-protected-project-export-error.jpg)
- 对照项目实际触发浏览器下载并返回工作记录。截图表现菜单后的界面，压缩包成功由浏览器文件和独立解包确认。[下载后的页面](baseline-writable-project-export.jpg) [实际压缩包清单](baseline-browser-download.json)
- 两条真实请求的状态和失败调用栈。[服务请求](baseline-browser-requests.json)

候选 `41712/ui/` 使用同一正式前端入口与桌面尺寸。

- 从受保护项目的工作记录打开实际菜单，选择下载后收到浏览器 ZIP 文件。[下载菜单](candidate-protected-project-download-menu.jpg) [下载后页面](candidate-protected-project-downloaded.jpg)
- 对照项目通过同一菜单实际下载。[对照项目页面](candidate-writable-project-downloaded.jpg)
- 两份浏览器文件的独立 ZIP 读取、两条 200 请求、原文和实际 Git 状态。[下载结果](candidate-browser-archives.json)
- 普通文件夹实际下载的 422 和准确原因，以及最终三条草稿与零执行计数。[正式错误对照](candidate-non-git-error.json)
