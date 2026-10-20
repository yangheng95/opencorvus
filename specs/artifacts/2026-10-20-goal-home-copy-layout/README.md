# Goal 首页说明与入口层级

452单agent，见[方案、Recall与实际结果](../../records/2026-10/2026-10-20-goal-home-copy-layout.md)。

首页原说明继承12px紧凑状态条字号，创建按钮为24px；仅home改用既有14px body和md主按钮，实际30px。初查的截断没有在原页面复现，保留原自然换行，没有用覆盖规则修一个未证实的错误。

- `before-home-en.png`、`before-narrow-en.png`：原正式构建的1280×720实际页面，280/433侧栏宽度。`before-metrics.json`为人工调查中的只读尺寸观察，不能代替截图。
- `verified-home-en.png`、`verified-narrow-en.png`、`verified-home-zh.png`、`verified-narrow-zh.png`：冻结新正式构建的真实页面及人工视觉复核；完整正文、主按钮、模块顺序和对齐可见。`verified-metrics.json`记录14px正文、21px行高和30px按钮。
- `verified-guide-en.png`、`verified-guide-zh.png`：原使用指南可实际打开、三步说明完整，双语已复核。
- `verified-create-en.png`、`verified-create-zh.png`、`verified-cancel-zh.png`：项目/全局首页创建真实Chat、自动打开既有Goal表单、关闭保留空Chat。`http-interaction.json`记录原生产HTTP的201结果；`data-verification.json`直接readonly SQLite确认真实Session归属及schema2/94完整历史。未提交新的Goal执行，不将预检或441历史执行伪称为本轮新执行。
- `ui-promotion.json`记录原/新资源引用。先替换自有磁盘UI并刷新时，原服务仍持有启动时冻结的旧bytes，故启动第二个新鲜服务验证；这符合overlay-ui.ts当前资源一致性合同，没有修改该合同，也没有重启用户应用。
- `results.json`记录两次实际gpt-6.1-sol流式预检、公开shutdown及原physical/output/request/launcher结算。原句柄57603/35349均exit0；自己的tab52/53均关闭。
- build/renderer、类型、i18n、CSS token、格式、docs和架构索引日志仅为补充。没有UI自动化、DOM断言、快照或像素比较。构建中现存第三方use-client及大chunk提示保留，不伪称已解决。
- `private-pair-retirement.json`在全部原结算和runtime配对退休后，核对原授权metadata及完整目录，扫描实际敏感值并退休本轮私有auth/models副本。

未更改schema、调度、LLM协议或用户服务；未进行POSIX或移动端验收，未更新版本或发布。配置保存性能原10s/5s目标仍未达标，继续迭代。
