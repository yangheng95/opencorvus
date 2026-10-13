# Provider API Key 配置事实证据

[第九批Recall与方案](../../records/2026-10/2026-10-13-provider-credential-presence.md)。[资格矩阵](qualification.json)记录24张本批真实桌面截图、37项105断言、原Sol失败与修复后4条目标模型流式200/eof，以及自有进程原始退出证据。结构检查、夹具合同和在线模型资格分别标注，不互相替代。

前态：[项目saved零模型](before-project-saved-key.png)、[单环境Key](before-project-environment-key.png)、[真实发现成功但placeholder错误](before-project-edit-discovery.png)、[全局saved零模型](before-global-saved-key.png)。

后态：[英文项目saved](after-project-saved-key-en.png)、[环境](after-project-environment-key-en.png)、[明确空](after-project-empty-key-en.png)、[中文排除条目编辑未知](after-project-unprojected-edit-zh.png)、[中文全局saved](after-global-saved-key-zh.png)、[真实模型选择](after-global-composer-zh.png)。

真实故障与恢复：[Auth读失败两个输入](after-global-auth-failure-edit-input-zh.png)、[Auth恢复](after-global-auth-recovered-zh.png)、[Key保存成功但配置清理失败](after-global-config-partial-save-zh.png)、[配置故障编辑未知](after-global-config-partial-edit-zh.png)、[配置恢复](after-global-config-recovered-zh.png)、[网络失败保留行但凭据未知](after-global-transport-failure-edit-en.png)、[最终源码原页刷新恢复](final-global-transport-recovered-edit-en.png)。均为1280×720生产 `/ui`，主agent逐张人工查看；截图包含真实原配置JSON错误片段但资格输入只有虚构样例，没有私有凭据。

[生产HTTP/物理端口](runtime/physical-ports.json)、[首轮Sol原失败](sol-01/failure.json)、[修复检查器后业务完成](sol-02/qualified.json)、[原进程exit0与配对清理](sol-02/physical-exit-pair-cleanup.json)、[14项正向测试](checks/credential-presence-audit-after-14.log)、[凭据字节检查](credential-evidence-scan.json)可独立核对。未知字段在PowerShell汇总中为null，原公开协议为字段缺席。

检查器按真实Session、输入message、agent与assistant身份绑定请求，并等待本轮真实reader自然EOF。首轮不能按Session首项把合法Memory并行误判为Chat未完成；失败后主动stop中断Memory的原证据保留。完整Task/Mission/重启故障矩阵没有实跑；DashScope正向marker只有源码复核，没有独立真实环境资格。修复前14项红输出仅在exec63146工具历史，未保留独立日志文件。

`qualification/`中的脚本仅启动显式自有生产服务、正常HTTP验收、读取持久事实和流式审计，不是UI自动化测试。浏览器仅由主agent通过Computer Use实际交互，没有UI断言、网络拦截或截图基线。

检查日志归档副本仅统一换行并去除工具原生行尾空白；原始日志仍保留在独有运行目录，退出码由原exec与独立父进程回执核对。
