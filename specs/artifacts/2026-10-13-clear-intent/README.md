# 清除操作验收证据

[Recall、全调用影响分析与方案](../../records/2026-10/2026-10-13-clear-intent.md)。本批两个真实界面缺陷：搜索清除后丢失键盘焦点；代理空字段保存未删除旧值。无真实凭据、模型请求或外部写入。

## 桌面页面人工复核

| 场景 | 实际结果和截图 |
| --- | --- |
| 修复前设置键盘清除 | [失败截图](search-clear-before.png)：network→Tab→Enter→直接键入外观，搜索保持空且焦点落到页面 |
| 修复后设置键盘清除 | [结果](search-keyboard-after.png)：同顺序键入外观，搜索显示外观并保留焦点 |
| 修复后鼠标清除 | [结果](search-mouse-after.png)：点击X后直接键入网络，查询正确，当前通用页仍在 |
| 搜索不替换当前编辑页 | [未保存代理草稿](search-retains-proxy-draft.png)：输入外观筛选，当前Network及未保存字段保留 |
| 英文版本搜索 | [结果](release-search-after.png)：0.1.22→键盘清除→直接键入0.1.25，呈现1 version且焦点仍在 |
| 模型选择器既有外部ref | [结果](model-search-after.png)：打开时搜索获焦点，键盘清除后直接键入model；关闭回到触发按钮。当前无已认证Provider，仅验证输入和开关，不声称模型筛选/模型请求 |
| 修复前代理密码清空 | [保存前空值](proxy-empty-before-save.png)→[保存后错误回填](proxy-empty-before-restored.png)；[配置记录](clear-before-persistence.json)密码长度15，预期0 |
| 修复后清空密码保存 | [已保存空密码](proxy-password-cleared.png)、[实际配置](password-cleared-config.json)：用户名保留，配置为用户名认证且空密码 |
| 再清空用户名并重开 | [字段区域](proxy-both-cleared-fields.png)、[实际配置](both-cleared-config.json)：两字段空，URL与开关仍保留。首次[重开截图](proxy-both-cleared-reopened.png)字段在折叠下方，不能单独支持空字段结论 |
| 英文重开并保存 | [结果](proxy-empty-en-saved.png)：空用户名和密码维持，显示Saved |

所有截图实际呈现并人工查看，没有UI自动化测试、DOM或像素断言。当前覆盖Windows桌面浏览器1280×720、中文和英文深色。Memory加载中、Scheduled忙碌、其他Artifact具体动态状态未逐项实页验证；19调用完成代码审查，18可清除入口统一迁移，不能把源码审查或类型检查称为这些状态的视觉验收。Mailbox保留原无X合同。没有操作测试按钮或发出代理外网请求。

## 功能与服务

[21项相关正向功能回归](tests-clear-regression.log)全部通过，含schema、BrowserRuntime解析、真实Bun本地代理和Node Undici CONNECT；没有新非UI实现，回归不替代上述保存/焦点页面证据。[类型](types-clear-after.log)、[正式私有构建](build-summary.log)和[文档检查](docs-clear.log)通过。

前态源码服务经production stop，[终态](before-terminal.json)、原exec72906 exit0。后态为独有ui-clear-after构建快照与全新runtime，[启动](after-ready.json)→[终态](after-terminal.json)；原exec48586 exit0且[物理退出和端口关闭](after-physical.json)已核对。只关闭本任务创建的页面和服务。

代理删除只移除当前配置文件的覆盖，既有全局继承仍生效；不能宣称关闭上层认证。没有发布、tag、Release、真实Provider或GPT-6.1 Sol端到端验收，本批无需模型执行。
