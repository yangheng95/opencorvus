# 0.1.55 发布证据

[方案与结果](../../records/2026-11/2026-11-25-release-0.1.55.md)。[v0.1.55](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.55) 已发布；冻结来源 `b3c36e74f8424281ea4d74bfb7763d2b2efa02fa`。

原生运行 [45452171188](https://github.com/yangheng95/opencorvus/actions/runs/45452171188) 第二次执行成功，23 项成功、6 项非适用跳过。准确配对官网 [45461406097](https://github.com/yangheng95/opencorvus/actions/runs/45461406097) 首次八项成功。原创建 2026-11-24 17:46:01 UTC，最终 18:43:33 UTC，57 分 32 秒；没有延长一小时原预算或改写来源。

## 检查与发布回执

- [本地准入](local-qualification.json)：17 个真实后端文件 121 项、21 个纯数据/服务文件 231 项、根合同 148 项，共 500 项通过，一项仅 GitHub Linux sudo 调用检查在 Windows 跳过。服务模拟只证明局部契约。另三个文件合同 72 项通过，与原集合有重叠，不累加为 572 项；详见方案。真实生成、八项类型任务、语言、样式、文档、前端及完整官网构建通过；最终干净检出由正式流程再次验证。
- [依赖复核](dependency-qualification.json)、[实际缓存对象](dependency-caches.json)及 [Intel 编译证据](intel-proof.json)：统一主题真实消费者已经使用的 i18next 26.3.6，移除旧锁图分支，实际冻结安装和审计通过。没有伪称本机复现漏洞；缓存观察不代替真实编译或运行。
- [标签/空草稿归属](prepare-owner.json)、[最终原生运行](native-run.json)、[准确官网运行](website-run.json)及[汇总结论](release-result.json)：五平台桌面/命令行及完整格式检查成功，13 条首次运行与重启回执各创建四会话、保留两个，未使用真实 Provider（模型服务）。不代表全部产品或五平台窗口视觉验收。
- [首次失败诊断](native-diagnostic.json)与[同运行重试](native-retry.json)：Intel CLI 的 DOCX 渲染首次无输出 45 秒而失败。唯一失败集合重试后，两个归档各自原有 PPTX/DOCX/XLSX 生命周期成功；没有增大超时或跳过检查。原日志无法定位渲染内部阶段，首次原因仍未知，重试成功不宣称已根治。
- [公开读回](public-readback.json)：29 项实际对象、28 条校验清单、五平台签名稳定更新、双语 GitHub 正文及官网 18 项清单均吻合准确冻结交付。[18 条真实下载响应](public-downloads.json)均为 HTTP 200。
- [发布前库存](release-inventory-before.json)、[发布后库存](release-inventory-after.json)及[保留记录](cleanup.json)：原 30 对象保留，仅新增本版为 31；一个候选、一次失败集合重试，91 条历史日志保留。

## 实际页面和随包复核

[中文官网](website-zh-CN.jpg)与[英文官网](website-en-US.jpg)完整页面均已亲自查看，日期、分类、正文与限制可读；网站语言链接真实切换。

[公开 Windows 基础归档](published-cli-asset.json)为 146078720 字节，实际下载与服务不可变对象相符。通过该包 `--version` 及随包 `/ui/` 的设置日志，未使用开发构建代替公开包。

| 语言 | 实际截图 |
| --- | --- |
| 英文 | [开头](published-settings-en-US-top.jpg)、[修复中段](published-settings-en-US-middle.jpg)、[末段](published-settings-en-US-end.jpg) |
| 中文 | [开头](published-settings-zh-CN-top.jpg)、[修复及末段](published-settings-zh-CN-end.jpg) |

各语言截图有正文重叠，覆盖本版完整条目。英文通过真实 View 菜单切换中文，标题、分类、导航、日期及网站链接随语言更新；仅真实页面交互和人工视觉复核，没有界面自动化测试。

[运行回执](published-ui-runtime.json)和[物理结清](published-ui-settlement.json)确认五分钟自有预算内完成，未转移凭据、发送消息或启动任务。两页关闭、正式关闭接口 200，准确后端及监督进程退出、端口释放、自有临时根目录删除。

本版已知边界完整写入同源日志：保存后首次继续改名可能忙碌，待磁盘检查结束后可重试；旧页升级后需刷新，混用旧/新版本编辑未单独验收；直接 Git 客户端应提供 `expectedBranch`；数据库保持版本 13；macOS 为临时签名、尚未 Apple 公证。冻结后主线修复归后续交付。
