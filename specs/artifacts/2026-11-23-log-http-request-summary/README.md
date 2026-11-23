# 折叠请求日志的真实桌面截图

基线为独立开发服务 40834，本人以只读请求产生三个实际文件访问，并逐张复核截图。

- [01 英文 100%，六条折叠请求的详情按钮同名且路径不可读](01-baseline-en-100-log-details-same-name.jpg)
- [02 英文 100%，展开后才看见真实请求路径、状态和响应码](02-baseline-en-100-route-and-phase-only-in-open-details.jpg)
- [03 简体中文 160%，折叠行仍为 request，结构字段截断](03-baseline-zh-160-request-paths-hidden-by-field-preview.jpg)

## 候选

独立开发服务 40836，英文 100% 和简体中文 160% 桌面截图。

- [04 英文折叠行明确区分路径、开始和响应码](04-candidate-en-100-distinct-collapsed-requests-and-actions.jpg)
- [05 英文输入完整方法和路径，经 Tab 选择正确 200 响应并展开](05-candidate-en-100-path-search-opens-exact-response.jpg)
- [06 英文非请求诊断保持实际文字和普通详情动作](06-candidate-en-100-non-request-record-retains-source-text.jpg)
- [07 简体中文折叠行显示长路由及实际已响应 404](07-candidate-zh-160-404-shows-actual-response-and-path.jpg)
- [08 搜索中文状态只命中 404 响应，键盘打开对应条目](08-candidate-zh-160-localized-search-opens-exact-404.jpg)
- [09 长路由的实际 404 结构化字段和原始日志均可阅读](09-candidate-zh-160-404-record-retains-structured-and-raw-data.jpg)
- [10 简体中文组合搜索精确查到下载请求的开始条目](10-candidate-zh-160-combined-search-finds-started-download.jpg)
