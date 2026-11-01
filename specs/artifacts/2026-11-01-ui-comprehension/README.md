# 完整界面理解体验证据

对应[完整路径调查](../../records/2026-11/2026-11-01-ui-comprehension.md)。保存实际后台页面原图及必要公开结论；用户参考原图保留在其原附件位置，不上传私人内容。未完成的路径不预填通过，认证/数据库/私人诊断不入库。

37张原图均来自本人后台隔离的正式CLI `/ui/`，未操作用户窗口或18571。界面为桌面1280×720、当前12px字体。最终代码/类型/i18n/CSS token/文档检查通过；截图是人工体验证据，未运行或新增UI自动化。

| 体验路径 | 主要证据 | 人工复核结果 |
| --- | --- | --- |
| 进入与开始 | [中文首页](17-final-home-zh.jpg)、[最终用途菜单](37-final-focus-menu-zh.jpg)、[英文模式选项](14-final-mode-options-en.jpg) | 导航名称可见；用途/处理方式及描述可读；普通消息与持续目标区别可见 |
| 高级能力与草稿 | [选中技能](15-final-skill-selected-en.jpg)、[关闭目标后原草稿](16-final-home-draft-en.jpg) | 真实输入引用可选择/取消；关闭未提交目标保留原稿 |
| 执行与继续 | [真实交付](19-final-live-result-zh.jpg)、[归档页](20-final-archive-zh.jpg)、[归档只读](21-final-archive-readonly-zh.jpg)、[恢复后回复](22-final-restored-followup-zh.jpg) | 相同Session改名、归档、阅读、恢复后实际跟进成功 |
| 单文件阅读 | [新CSV的审阅](23-final-live-single-review-zh.jpg)、[历史文档审阅](24-final-historical-review-zh.jpg)、[逐次原比较](25-final-original-edit-zh.jpg)、[排版阅读](26-final-document-reading-zh.jpg)、[精确行号](27-final-source-location-zh.jpg) | 单文件省去无效目录和筛选；未知比较一次说明；当前文档与历史逐行改动区分；行51定位源码 |
| 多文件 | [完整目录](28-final-multiple-review-zh.jpg)、[筛选单个结果](29-final-multiple-filter-zh.jpg)、[清除后切换](30-final-multiple-selection-zh.jpg) | 三文件保留原筛选/选择/独立滚动，过滤成一个结果仍可清除 |
| 异步焦点 | [切换中菜单](33-final-fast-project-menu-en.jpg)、[就绪后仍打开](34-final-menu-after-project-ready-en.jpg)、[全局新建](35-final-global-new-menu-en.jpg)、[模式生效](36-final-intent-change-en.jpg)、[中文最终菜单](37-final-focus-menu-zh.jpg) | 后到的输入框聚焦不再关掉已打开菜单，正常模式改变仍生效 |

[verification.json](verification.json)记录8个实际GPT-6.1 Sol请求、全部流式/HTTP200/EOF（End Of File，响应流结束）、原身份恢复和完整数据资格；[actions.csv](actions.csv)是模型实际生成的合成QA产物，8条原事实、3位责任人（3/3/2）、1条未知期限逐项核对成功。

01–04为改前中文证据，05–12为首轮页面，包含暴露留白/英文截断的中间版本；05文件名虽含home，实际画面是启动时恢复的旧任务，不作为首页通过证据。13–32是真实Sol实例中的交互；31是项目异步聚焦抢走菜单的失败中间帧，32是就绪后重新打开，不能代替修复验收。33–37才是该焦点根因修复后新原生实例的复验。所有中间问题保留，不覆盖失败原图。

原过期认证实例在监听/复制凭据前失败，0请求、16未用额度退休；原认证经用户明确授权从现有owner续期成功。visual、Sol、focus三实例均public shutdown200、原生退出0并结清，认证/模型目录副本已退休。最终从251387个旧行、94个旧项目和223个附件资格复制，当前251392行、95项目；原schema9/92表、旧业务/Git/附件及源DB完整。不存在清库或真实用户数据库升级。

本轮没有宣称整个产品已无理解障碍。扩展/模型原文、文件身份、真实工具标识仍保真；可继续精简的高级技术信息与多文件空计数留待后续具体体验，不以本次结果覆盖原873未完成事实。
