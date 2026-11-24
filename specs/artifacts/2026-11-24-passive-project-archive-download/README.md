# 项目交付包下载的桌面证据

基线 `41710/ui/`，正式入口文件 `main-DPV2Gw9j.js`，1280×720 实际桌面。

- 受保护项目从工作记录行的下载菜单返回 500，真实错误弹窗含请求号。[失败详情](baseline-protected-project-export-error.jpg)
- 对照项目实际触发浏览器下载并返回工作记录。截图表现菜单后的界面，压缩包成功由浏览器文件和独立解包确认。[下载后的页面](baseline-writable-project-export.jpg) [实际压缩包清单](baseline-browser-download.json)
- 两条真实请求的状态和失败调用栈。[服务请求](baseline-browser-requests.json)
