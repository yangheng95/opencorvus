# 本次真实运行器源码

此目录是本轮实际执行的验收器源码原件，作为可复查证据冻结。活动文件在仓库忽略目录`.tmp-product-iteration/expert-word-feedback/`，不是新的产品机制或公共配置面。全部模型交互经过真实生产CLI、HTTP Task API、RealProviderAudit和gpt-6.1-sol流式Provider；本目录不提供UI自动化测试。

- `original-driver-source.txt`对应`run.ts`：同一个原营销Task、原310次加本轮最多50次、真实消息、capture、shutdown、四份authority退休。原prepare已完成且有提交守卫，不能在原实验目录重跑或重置预算。
- `original-archive-source.txt`对应`archive-original.ts`：消费真实Task/conversation响应、精确原件与当前文件、Provider reader及进程回执，导出原Task失败证据；不把生成脚本的局部修改冒充新Word。
- `base-driver-source.txt`对应`base.ts`：独立全新Base项目，先files与真实离线依赖预检，再prepare paired凭据，serve/start/observe/capture/shutdown/retire。重复start有持久守卫，观察不重启Task。Base从既有embedded package入口读取，不经市场payload安装。
- 两份launcher原件只使用自己的原生ProcessFacade/ProcessSupervisor job，并清理环境、验证专用端口；所有退出须结算physical/output/request并保留原launcher退出码。Base在该子进程PATH配置本次离线依赖，不操作用户Office或服务。
- `base-verification-source.txt`与`word-content-checker-source.txt`消费当前Completion Decision、完整snapshot manifest与资源，以及真实阅读版，核对全部正文及格式属性。渲染页另由主agent实际逐页查看；静态属性不宣称视觉通过。
- `tool-fact-reader-source.txt`读取真实GET messagePart，取得conversation摘要省略的原命令、输出和错误。`persisted-media-query-source.txt`是服务原生结算后实际执行的只读SQLite查询，取得独立审阅者三个artifact_read的原request/outcome、Message/Session和真实附件；没有重开服务或调用模型。
- `base-archive-source.txt`在纠正只统计本地read的假设后，消费实际完整PNG回执及五个原附件导出证据，附带精确秘密扫描；不合成不存在的工具调用。

复查时优先读取原始JSON、工具错误、项目提交差异及实际截图。若另行重放，应先读取方案Recall并为新用例选择全新隔离目录和未占用端口，保持明确Provider授权与每服务不超过360次；不得将已失败原轮删掉后伪装为首次成功。这里的源码包含本次非秘密绝对路径，不能在未知机器上直接执行。
