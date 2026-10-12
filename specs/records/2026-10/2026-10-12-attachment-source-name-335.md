# 335 附件来源名称与只读打开

[Recall与修改前分析](../../artifacts/2026-10-05-connection-workspace-authority/attachment-source-name-plan-335.md)。单agent修复附件来源丢失原名及可写打开的问题，复用当前metadata、source-file和绝对来源只读入口；普通文件保留编辑能力。

canonical URL、两种shorthand、当前存储物理路径及Windows大小写别名统一保留真实名称和来源身份。Unicode/括号名称不会再被暂存文件安全白名单替换。FileEditorTarget的displayName不进入资源加载/保存身份。旧来源快照不批量改写。

[实际证据与7张人工截图](../../artifacts/2026-10-05-connection-workspace-authority/attachment-source-name-335/README.md)。真实开发模式18311/Work Chat运行7次gpt-6.1-sol流式请求全部HTTP200/EOF；实际两个canonical附件和普通项目文件读取、PDF选择复制、Markdown引用24-25行、只读输入、普通文件实际保存、重开和历史回看通过。原件字节及进程/凭据配对清理已核对。70024原启动句柄实际exit0。

聚焦后端13测试/44断言、目标服务10测试/28断言、SDK生成、前后端类型、最终build、i18n、docs通过；最初重复ariaLabel导致的类型错误已修复，失败日志保留。没有运行UI自动测试。当前构建main-CehUoqfl.js。范围提交并同步上游后继续单agent迭代；不发布版本。
