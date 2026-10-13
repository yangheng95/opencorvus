# 模型数量与服务商搜索计数证据

[Recall、根因、实施与验收](../../records/2026-10/2026-10-13-provider-count-projection.md)。上一批delivery/push/integration为实际前序事实。本批真实三轮生产实例、接口/账本数据、退出事实与辅助检查见[verification.json](verification.json)。

本批使用独有无真实凭据的声明目录与本地协议参与者，经过生产config/catalog/ledger和实际 `/ui`。这些样例不证明在线供应商认证、推理或财务账单；源码和静态数据不替代主agent实际截图复核。没有UI自动化测试。

- 修改前项目model搜索8/12、Local one单行1/12，全局7/10；[单模型发现](before-discover-one-en.png)与[用量](before-usage-en.png)呈现1 models。
- 修改后[项目英文8/8](after-project-all-en.png)、[中文8/8](after-project-all-zh.png)、[全局英文7/7](after-global-all-en.png)、[中文7/7](after-global-all-zh.png)，保留Configured/Catalog各自事实；单行与零结果分别1/8、0/8，清除恢复完整行。
- 实际GET/models：[英文单模型](after-discover-one-en.png)、[双模型](after-discover-two-en.png)、[中文单模型](after-discover-one-zh.png)、[零模型明确错误](after-discover-zero-zh.png)。目录[配置展开](after-catalog-expand-zh.png)保持。
- 实际Composer：[1/2组](after-composer-all-en.png)、[过滤为1](after-composer-filter-en.png)、[空结果](after-composer-empty-en.png)、[选择后重开](after-composer-selected-en.png)、[中文保留选择](after-composer-selected-zh.png)和[中文过滤](after-composer-filter-zh.png)。选择但未发送聊天。
- 生产流式账本：[英文1/2模型](after-usage-en.png)、[中文1/2模型](after-usage-zh.png)；另一个未产生调用的独有实例呈现[英文空状态](after-usage-empty-en.png)、[中文空状态](after-usage-empty-zh.png)。完成Today/This week/This year周期切换。
- enabled仅含catalog-two/count-two、disabled含count-zero的实际生产投影：[项目4/4](after-filtered-project-zh.png)、[全局3/3](after-filtered-global-en.png)；未在活动目录内的[自定义项仍可编辑](after-filtered-edit-zh.png)，分子/分母与可呈现行共源。

before-runtime、after-runtime、edges-runtime各保存真实HTTP初始数据、owner/occurrence、terminal/exit与原stdout/stderr；归档配置移除API-key值，参与者日志只记录路径、模型与流式参数。两个常规scope各3次协议调用75 Token，edges scope0次。三个原exec实际exit0、端口均释放。count-page-runtime.ts与launch-count-page.ps1是独有服务准备与正常关闭代码，不是UI自动化测试，页面交互全由主agent逐步操作。

typecheck、双语目录2199键、两轮Node build、docs348ops/26groups均通过，只作为辅助证据。语言设置切换会卸载Provider页并退休草稿，未声称同一draft连续切换已实页验证；tc的1000以上数字分组仍属旧边界。无真实Provider凭据/在线模型调用，本批无LLM行为变更，不借用前序Sol验收。
