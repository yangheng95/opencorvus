# 296 来源原文阅读位置

[Recall 与实施分析](../text-owner-plan-296.md)

单 agent 使用既有真实 Task 153 的完整历史；不创建新 Task 或成员，不调用 Provider（模型服务商），不移交凭据。原 ResearchStudio 的实时 Rendering 闪烁仍未解决，不能以本轮历史阅读通过代替。

## 修复与人工验收

修复前，researcher 第一个 webfetch 输出读到 top=3732 后关闭/打开 Dock，工具仍展开但内部 top=0。[中段](history-01/05-output-read-before-return.png)与[跳回开头](history-01/06-output-return-reset.png)来自同一实际页面尺寸下的连续操作。点击 Source 标题确实在独立标签中打开了[原 W3C 网页](history-01/03-actual-source-page.png)，初次只看到 Tooltip 的截图不代表打开失败。

ToolPayload 现将滚动位置写入既有会话展示记录，按 canonical Session/Message/Part/slot 和格式区分。挂载后在可见内容盒中恢复，用户输入优先；隐藏和退休容器不能覆盖当前会话。全文展开不会用被布局夹到零的位置覆盖原预览读位。唯一改动在 ToolPayload、conversation-ui 及架构合同，未更改来源数据、HTML 渲染器、后台请求生命周期或 SourceExcerpt。

正常新构建 main-Dq5yZFkH.js，18253/tab45，root 人工观察：

- [读取中段](history-02/01-output-reading.png)与[Dock 返回](history-02/02-dock-return-reading.png)：top=2160、height=359、total=15811 保持；新页面宽度与首次复现不同，只比较各自同尺寸操作。
- [全文收起](history-02/04-preview-restored.png)、[工具重新展开](history-02/05-tool-return-reading.png)：仍为 top=2160。
- [跨对话返回并重新选择原成员](history-02/07-task-member-return-reading.png)：仍为 top=2160。06 图只记录返回任务时 Dock 尚关闭，不能单独称为读位验收。
- 已有 tester 的真实 JSON（JavaScript Object Notation，结构化数据表示）输出：[Raw 返回](history-02/10-raw-return-reading.png)为 top=1440；[Readable 返回](history-02/11-readable-return-reading.png)为 top=57.333332，各自恢复。其他四个工具输出仍各自 top=0。

全部操作通过真实页面；只读 DOM 几何用于补充截图，没有 UI 自动化测试、断言、模拟消息或事件回放。types 57554 actual0、build 48998 actual0（53.43s）。

## 运行保管与后续

原完整 90 表分别复制到两个独立历史实例。复现实例 parent87932、验收实例 parent2958 均通过原 exec join actual0；独立物理/输出/请求/端口及配对关闭通过。两个 final-canonical-custody 保留 19 表和 47 个执行生命周期完整值相等、运行配置直接字节相等及两个原项目文件属性比较。属性比较不是文件全文身份证明。各自固定 900000ms，未延期；准确关闭时刻及余量见 checks.json。各自五个 Bun 本地产物在相关 checker 结束后按精确出生与限定路径归档。

工具准备时首次缺少新证据目录，修正后重跑；第二阶段路径改写误动了原272 guard引用，修复为原历史路径并重跑资格检查。较早的只读结果单独保留为 pre-guard-startup-observation，不作启动资格依据。

另有未归因观察：主进度卡的 Open 鼠标点击后两次未打开侧栏且卡片位置改变，键盘 Enter 可正常打开；12/13 图分别记录结果。未确认是点击时布局变化还是其他交互机制，下一轮应在该真实入口记录指针/焦点与测量时序，再决定修复。没有把它归因于模型或后台调度，也没有据此调整点击行为。
