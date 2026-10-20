# Goal 首页的内置浏览器实际复核

2026-10-20，单 agent，实际1280×720内置浏览器页面；[调查与方案](../../records/2026-10/2026-10-20-goal-home-live-review.md)。仅中英首页正文改为明确预算可选，不改布局、数据或执行规则。

- [最终中文首页](after-home-clean-zh.png)、[最终英文首页](after-home-en.png)：正式前端构建冻结到新18735服务后重新查看。入口、按钮与正文完整，未复现裁切。
- [原中文首页](before-home-zh.png)、[原英文首页](before-home-en.png)：预算文案调整前的实际页面。
- [中文指南](guide-zh.png)、[英文指南](guide-en.png)、[项目创建表单](create-project-ready-en.png)、[全局创建表单](create-global-zh.png)：真实交互。关闭全局表单后保留真实空Chat。
- [自动执行](automatic-turn-en.png)、[英文完成状态](completed-en.png)、[中文完成状态](completed-zh.png)：真实控制器触发gpt-6.1-sol流式回复GOALREADY459，预算1/1，38,351令牌；随后operator在详情里提交明确完成证据。不是模型自行判断完成。
- [持久化与Provider事实](manual-ui-facts.json)、[结果](results.json)、[检查来源](checks.json)、[正式构建](build.log)：只读核对真实执行身份、预算和输出；不是UI自动化。
- [数据保留](history-verification.json)：schema2、109 Project/147 Session，106/143与108/146两份基线的全部身份、归属和目录逐项保留。
- [首个服务结算](goal-home-live-review-459-settlement.json)、[新构建服务结算](goal-home-live-review-459-final-settlement.json)、[成对授权退休](private-pair-retirement.json)：原生物理、输出、请求、launcher均结算；原句柄53441/17201都exit0。完整模型目录成对，实际凭据值扫描通过，复制对退休，来源未写入或刷新。

浏览器清单虽报Work本地浏览器禁用，用户指定的同一官方CUA内置浏览器直连实际成功，先前泛化的不可用判断已纠正。用户18571页面、窗口、进程与真实用户数据库均未操作。

这轮不重报旧Sources/侧栏Rendering修复为最新验收；完整历史配置保存10s/恢复5s性能目标仍未达。未新增或运行UI自动化，也未发布版本或安装包。
