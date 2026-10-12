# 330 图片文件来源可查看

对应[Recall 与修改准入](../source-image-plan-330.md)。本轮 root 独立开发、交互和视觉复核，使用普通 Work/Chat，不派发产品或开发子 agent。

## 问题与改动

真实 read 工具读取项目 source-image.png 后生成来源。点击来源，[原画面](screenshots/01-image-source-before.png)仅显示“This file is not editable in the overlay”，用户无法查看图片。同一 file/content 实际返回 image/png、base64，22168 字节与授权 PNG 原图一致，见[后端响应证据](image-content-before.json)。图片读取已经成功，缺失的是呈现分支。

根因是 FileEditorPane 用文本可编辑性决定全部内容呈现，把已经取得的图片归入不可编辑占位。改为从同一 FileContent 派生图片地址，复用现有 PreviewableImage 和全屏图片宿主；图片显示已有 Read only 标记，文本保留原 CodeEditor、保存、范围、错误和重试逻辑。文件图片容器仅增加居中、边界滚动和窄宽约束。没有新增后端接口、图片请求、缓存、配置或平行预览实现。

生产改动限于 `FileEditorPane.tsx` 与 `workspace.css`，当前架构 07-panel 同步记录契约。正常 Explorer、来源和文字链接共用这个面板；本轮直接验收的是来源入口，没有宣称每个入口都分别操作过。

## 真实页面复核

实际开发 `/ui`18301，已完成构建 `main-D0irXPAg.js`；只刷新自己创建的 IAB 页面108，Native 服务、凭据范围和时间边界未重置。

- [02 修复后](screenshots/02-image-source-after.png)：原来源打开蓝色鸟图标，Read only 清楚可见。
- [03 全屏预览](screenshots/03-image-full-preview.png)、[04 放大](screenshots/04-image-zoom.png)：实际点击打开，100%→125%→100%，随后关闭返回原文件。
- [05 窄侧栏](screenshots/05-image-narrow.png)：键盘 End 调整到最小280px，图片完整容纳；截图捕获缩放动画中的282值，下一次实际状态为280，未把动画中间值当作错误。
- [06 文本来源缺失](screenshots/06-missing-source.png)、[07 详情](screenshots/07-missing-details.png)：仅将本轮自己的 source-review.md 保管到同一 Run 的 quarantine 后，点击真实第24行来源产生404。说明和 Retry 保留，真实错误为 FileNotFoundError，请求 `5b142d8a-6774-4afc-84fe-e1ad8e1bc1ed`。
- [08 恢复后的第24行](screenshots/08-range-recovered.png)：按原路径恢复完整原文本，用原错误卡片 Retry 得到200（请求 `1a406f9c-caa6-47ba-8de0-420997795015`），第24行高亮并可见蓝色光标。只读辅助[焦点记录](recovered-focus-observation.json)指向真实 Editor textbox；未作 DOM（Document Object Model，文档对象模型）自动断言。
- [09 再回图片](screenshots/09-image-after-text-recovery.png)：跨图片、读取错误、恢复文本再回图片，内容与只读标记正确。

9 张截图全部人工查看。普通缺失/重试流程已在222覆盖，本轮补验与图片分支共存、精确行号和键盘焦点。图像实测为仓库现有256px PNG，未声称其他图片格式、损坏图片或超大图片均已逐项视觉验收；未扩展到图片编辑或其他二进制查看。

## 实际数据、检查与收敛

普通会话 `ses_-zUSCdxy0zz9iE9qKXK5` 保留真实 search_code 第24行 Source 与 read PNG Source。6 次实际 gpt-6.1-sol 流式请求均以 EOF（End Of File，流结束）收敛，预检分别证明凭据可用、完整模型目录投影及实际模型一致。两条真实来源、文件响应404/200及输入恢复见[后端正向检查](actual-backend-verification.json)。这是实际数据路径核对，不是 UI（User Interface，用户界面）测试。

原文件[保管记录](source-move.json)与[原路径恢复](source-restored.json)保留原文字，操作前核对了精确绝对边界；没有移动用户项目文件。PNG 是仓库资产原字节副本，未重新生成或修改图像。

类型检查句柄79118和构建20597实际退出0，构建56.19秒；没有运行任何 UI 自动化、组件测试、截图基线或全量测试。构建已有大块体积提示保留，不将其冒充新错误或完全优化。文档检查及正常提交/推送钩子验证各自范围。

自己的108页面已关闭。原启动句柄2404实际退出0；Native38452、Host77248、18301端口、输出和请求链正常完成，复制的 auth/models 成对清理，见[物理终态](live-01/source-image-330-live-01-physical-terminal-and-pair-cleanup.json)。周期收据、HTTP（Hypertext Transfer Protocol，超文本传输协议）摘要和 Provider 审计完整压缩，私有原件保留。归档前做了实际凭据匹配检查，不发布凭据。

总体 goal 保持 active；本轮修复图片来源查看缺口，不宣称整个产品体验与全部图片矩阵已完成。
