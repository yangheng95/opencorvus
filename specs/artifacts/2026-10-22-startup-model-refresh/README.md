# 启动页、Goal 与模型目录刷新证据

对应[实施记录](../../records/2026-10/2026-10-22-startup-model-refresh.md)。2026-10-22开始，最终验收于北京时间2026-10-23完成。

全部图片来自独立开发后端的真实 `/ui` 页面，通过浏览器交互后人工查看；没有 UI 自动化测试、快照断言或像素评分。

| 图片 | 内容 |
| --- | --- |
| 01-goal-before.png | 原创建表单，长说明及默认展开的预算 |
| 02-home-before-desktop.png | 原桌面首页 |
| 03-home-after-en.png | 新首页英文布局 |
| 04-goal-after-en.png | 首轮380px宽度，因预算展开偏窄而继续修正 |
| 05-goal-reviewed-en.png | 最终560px目标表单，继承示例草稿 |
| 06-budget-validation.png | 折叠的0预算提交时自动展开，原生校验定位 |
| 07-budget-draft-reopened.png | 关闭重开保留目标、5000令牌与3轮预算 |
| 08-refresh-success-en.png | 真实上游刷新，已配置0、目录233、刚刚成功 |
| 09-opencorvus-connect.png | 未配置时专用入口展开原密钥编辑区 |
| 10-home-final-zh.png | 中文首页，包含当时的设置悬浮提示 |
| 11-home-final-zh-clean.png | 最终中文首页，无悬浮提示 |
| 12-goal-final-zh.png | 最终中文默认目标表单 |
| 13-budget-final-zh.png | 中文可选预算与执行语义 |
| 14-home-narrow-workspace.png | 桌面左分栏扩大后的窄工作区 |
| 15-refresh-success-zh.png | 中文真实刷新成功，Databricks 26个模型可见 |

`live-route-check.json`：Node.js checker 实际调用两个正式后端路由，在线从 models.dev 下载目录并读取同一 canonical models.json；全局2734ms、项目1234ms，均HTTP 200/ok:true、233 Provider，Databricks实验模式input_audio=3.6完整保留。相同文件同时保留OpenCorvus与Kilo必需本地声明。

`refresh-before.json`、`refresh-after.json` 是修正User-Agent之前的真实网络失败，保留诊断经过，不当作成功证据。`refresh-requests.json` 保存最终真实请求与成功事实。后台新增4项正向成本/HTTP标识合同及原5项live refresh合同通过。Overlay与后台typecheck、双语、CSS token、renderer public surface、构建、docs与architecture检查通过；构建保留既有第三方directive、大chunk提示。

验收没有填写或提交Provider密钥，没有模型推理；最终19167进程清除了公开catalog声明的Provider环境变量，使用全新数据根。当前用户数据库、应用窗口与凭据均未修改。Goal实际跨轮执行不属于此次展示修改的新增资格。
