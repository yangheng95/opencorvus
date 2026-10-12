# 328 真实子会话 Sources 复查

对应[方案 Recall](../child-render-plan-328.md)。验收当前主交付 `2c0c20cdda96312e5343fbb15d9843eaf839033f` 的真实开发 `/ui`，本轮没有生产代码改动。开发全过程由 root 单独完成，未启动开发子 agent；隔离被测产品只运行一个只读研究员以取得真实子会话。

## 实际观察

真实 Task `tsk_g00VXnEDqf00hNH24dFW` 在 234259 毫秒后完成；子会话 `ses_hWhhXEgXRTv0CaPIXuDr` 的四段可见正文分别为 499、2054、2381、2910 字符。三次真实读取产生文件第 2/3/4 行与两个网页共五条 Source，未注入 Source、消息或重放事件。

- [文件来源收起](screenshots/03-file-sources-collapsed.png)与[展开](screenshots/04-file-sources-expanded.png)：主条目直接显示文件名和行号，其余两条紧凑展开，未形成旧截图中逐条“Sources 1”的大片留白。
- 点击第 4 行来源后，[文件加载完成](screenshots/06-file-source-line4-loaded.png)显示真实输入并高亮第 4 行。[05](screenshots/05-file-source-line4.png)保留点击后正常的短暂加载阶段，不把 Loading 画面算作完成。
- [返回子会话](screenshots/07-return-expanded.png)和[关闭重开](screenshots/08-reopen-expanded.png)后，文件来源仍展开，所读位置在相同段落。这里是终态阅读验证，不是持续生成期间的读位证明。
- [MDN 来源](screenshots/09-mdn-source.png)显示网页标题、域名和中文 `#参数`；点击真实条目打开的[实际页面](screenshots/10-mdn-actual-destination.png)位于“参数”章节。[目标地址](source-destination.json)保留原百分号编码片段。
- [无网页标题的长查询来源](screenshots/11-query-source.png)显示路径、完整查询与中文“北京市”，域名单列，折行未遮住正文。

所有 11 张截图均来自 root 的真实页面操作并逐张人工查看。截图 01 是研究员最后一段正文接近结束时的可见画面，02 是上翻后的正文开头。进入来源区时该研究员已结束正文生成；本轮**未覆盖来源展开期间后文持续增长的完整时段，也没有逐帧排除闪烁**。观察帧未出现重复 Rendering，不等于已证明原闪烁问题在所有情况下消失。未凭候选分组迁移修改渲染器或隐藏占位符。

## 数据链路与运行收敛

[实际后端校验](actual-backend-verification.json)与[正文/读取核对](observed-stream-and-narration-reads.json)分别保留正向结果和具体事实：12 次实际 `gpt-6.1-sol` 流式请求均结束；六个正文 Part 的事件最终值按既有终态 `trimEnd` 规则对应规范存储（负责人首段少一个末尾空白，其余完全相同）；四段研究员正文总计 7844 字符。负责人通过真实 `read_agent_message` 读取原有正文与工具结果，没有要求合并重写。

实际压缩 Task 事件流记录 5641 个事件，传输 713280 字节、解压 21564596 字节，终态为 `task.completed`。这是后端事实，不作为浏览器性能或视觉断言。[原事件归档](live-source-observation.json.gz)、[规范存储](live-01/canonical-current-conversations.json)、[Task 终态](live-01/task-complete.json)和固定 openedAt 起 900000 毫秒的[边界](live-01/task-boundary-admitted.json)可核对。

OpenAI 凭据与完整模型目录成对复制并预检，归档中不包含凭据。Task 真实原启动句柄 30796、事件观察器 77602、关闭及归档命令均实际退出 0。自有 IAB 页面 105/106 已关闭；Native 75876、Host 75092、18299 端口、输出和请求链完成收敛，复制的凭据/模型目录已清理，见[物理终态](live-01/child-render-328-live-01-physical-terminal-and-pair-cleanup.json)。五个本轮 Native 创建的调试 pile 在确认精确归属与终态后移入私有暂存，未删除用户文件。

本轮没有 UI 自动化测试、组件/DOM 断言或截图基线。未修改生产代码，所以没有重复构建或全量测试。私有后端核对脚本首次误用 `input.target`，实际协议是 `input.dispatch.target`；修正检查器字段后重跑通过，未归咎产品。文档检查及正常提交钩子的结果见本轮提交记录。

## 后续范围

总体 goal 保持 active。下一轮应先进入目标子会话并定位 Source，再观察后续自然生成及所有者切换，补齐本轮未覆盖的时段；未经真实证据不把推测改成根因。当前没有新确认的产品缺陷，不制造无依据补丁。
