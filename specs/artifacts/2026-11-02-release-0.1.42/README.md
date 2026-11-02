# 0.1.42 发布证据

对应 [发布方案](../../records/2026-11/2026-11-02-release-0.1.42.md)。[v0.1.42](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.42) 已完整发布，冻结源码91e157449f294b5a5c51bdddf2e89392f7745ba6。

- [正式原生运行](native-run.json)：41430303374，2026-11-02T10:37:29Z→11:07:58Z，30分29秒，23成功/6预期跳过，原60分钟预算不重置。
- [精确配对官网](website-run.json)：41433362193，6分24秒、八job成功。[最终结果](release-result.json) 保存publisher唯一返回ID、resolver的原source/parent和逐平台原检查输出。
- [公开回读](public-readback.json)：29资源、真实对象校验、五更新平台、18官网下载、GitHub正文与冻结根日志精确一致。
- [准备](readiness.json)、[标签和owner准入](prepare-proof.json)、[三平台定向CI](selected-ci.json)：仅两个变动后端文件，非整套后端或真实模型验收。
- [Intel预检](intel-preflight.json)、[实际缓存](intel-cache.json)及[正式命中证据](intel-proof.json)：预检25分40秒，正式冻结源码重新构建，Rust4分26秒；首次启动/重启使用realProvider=false。
- [实际下载对象](published-cli-asset.json)、[原生/UI隔离运行](published-ui-runtime.json)和[独立退休读回](owned-runtime-retirement.json)：Windows CLI145132660字节、真实版本42，原五分钟内正常close、监听/进程/临时根结清；未复制Provider凭据或发起模型会话，传输未量测。
- [前库存](release-inventory-before.json)、[后库存](release-inventory-after.json)及[清退记录](cleanup.json)：18公开/稳定对象、0草稿，原17对象全部保留，本轮一次成功且无删除。
- [告警范围](advisory-scope.json)：64条GitHub告警全部指向保留的历史研究requirements文件；产品Bun审计1732包零漏洞，不隐藏或改写研究证据。

全部截图均由真实页面交互后人工查看，没有运行UI自动化测试：

- 01—06：准备源码3891的双语日志局部原图；保留该阶段事实。
- [07英文发行包](07-published-app-en.png)、[08英文正文/限制](08-published-app-en-limits.png)、[09中文发行包](09-published-app-zh.png)、[10中文正文/限制](10-published-app-zh-limits.png)：实际公开包的设置日志。
- [13正式下载入口](13-published-download-zh.png)：正式官网完成后的0.1.42 Windows EXE链接。
- [14最终英文正文](14-final-notes-en.png)、[15最终中文正文](15-final-notes-zh.png)：冻结91完整正文，含演示文稿语言说明；在同源码准备部署41429775586成功后实拍，正式配对部署再次验证同一冻结源及公开下载。

数据库保持9及原迁移；macOS仍临时签名且未公证。没有宣称完整后台测试或所有模型任务已验收。
