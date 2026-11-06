# 0.1.47 发布证据

对应[方案与Recall](../../records/2026-11/2026-11-06-release-0.1.47.md)。**已完整公开交付**：正式原生42211985145、冻结产品777776922，23成功/6设计跳过；准确配对官网42215526460八成功。原11:40:29Z→12:16:39Z、2170秒/36分10秒，一次准入、无工作流重跑，早于原12:40:29Z截止。

下列证据分别覆盖原生/官网、公开回读及人工实页；首次启动和重启使用realProvider=false，不证明全部模型或执行组合。未新增真实模型调用。

- [准备检查](preparation.json)：57项后端、50项版本/协议、冻结依赖/审计和生成固定点通过。
- [原实图复核](source-visual-review.json)：三张已有QA截图已实际查看，原场景范围保持。
- [发布前库存](release-inventory-before.json)/[发布后库存](release-inventory-after.json)：原22对象身份/日期/发布标志精确保留，新47后23对象；83份历史双语日志保留。
- [准备官网](preparation-website.json)：同源八任务成功，336秒，不替代正式配对官网。
- [Intel预检准入](intel-preflight-admission.json)、[原生终态](intel-preflight.json)/[实际资格](intel-readiness.json)：1656秒、Rust缓存缺失与15分46秒原生编译；真实首次启动/重启及安装包通过，不移交debug产物。
- [正式准入](canonical-admission.json)、[准确owner](prepare-owner.json)：冻结777与42211985145、v0.1.47及436433306空草稿，归属实查一致。
- [完整结果](release-result.json)、[原生终态](native-run.json)、[配对官网终态](website-run.json)：实际返回官网ID、resolver产品777及父42211985145均核验；官网控制workflow来源36cb与产品来源分开记录。13份真实首次启动/重启资格、五平台及Linux三格式通过。
- [公开回读](public-readback.json)：GitHub latest47、29资源、28条不可变对象校验、5平台stable与版本manifest一致，18官网下载匹配唯一生成器；Release body精确来自冻结根双语日志。
- [正式Intel资格](intel-proof.json)：实际缓存/原生编译与首次启动/重启日志；没有移交debug产物。
- [实际公开包](published-cli-asset.json)：145157624字节Windows基线归档，下载内容与GitHub不可变对象完整性一致；实际exe版本0.1.47。
- [正常关闭](published-ui-runtime.json)/[独立物理清退](published-ui-physical-retirement.json)：自有空实例12:11:53.323Z→12:14:10.473Z，早于原12:16:53.323Z五分钟截止，公开关闭200、原TTY exit0，两进程/一监听和临时root已清退。
- [人工实页](manual-review.json)：四张公开包双语设置、两张官网双语全文及一张47下载入口，七图均实际查看，无UI自动化。
- [另行CI资格](regular-ci-observation.json)：常规全量CI三平台unit取消、汇总guard失败，未计通过；聚焦本地检查和完整原生交付分别记录。
- [清退与历史保全](cleanup.json)：本次一次准入成功，没有失败候选需要清退，保留所有健康历史发布和日志。

## 真实页面

公开包设置：[英文](01-published-settings-en.jpg)、[英文修复与限制](02-published-settings-en-limits.jpg)、[中文](03-published-settings-zh.jpg)、[中文修复与限制](04-published-settings-zh-limits.jpg)。官网：[中文全文](05-published-web-zh.jpg)、[英文全文](06-published-web-en.jpg)、[47下载入口](07-published-download.jpg)。

仅验证本版日志与公开下载，不扩大为全部界面、模型、历史或并发组合的验收。macOS仍临时签名且未Apple公证；数据库仍10，原自动迁移保留。用户18571、现用窗口/进程/数据库未操作，自有复核页均已关闭。
