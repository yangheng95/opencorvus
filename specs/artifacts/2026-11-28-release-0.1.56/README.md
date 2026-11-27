# 0.1.56 发布证据

[方案与结果](../../records/2026-11/2026-11-28-release-0.1.56.md)。[v0.1.56](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.56) 已公开，冻结来源 `d6bd641e329682b911257ca2caa5076e737889cc`。正式五平台与准确配对官网首次成功，30 分 30 秒，在原一小时预算内完成；29 项资源、五平台稳定更新、18 个官网下载和三处同源双语日志已复核。

## 执行及公开事实

- [本地准入](local-qualification.json)：625 项聚焦合同测试通过、1 项 Windows 环境条件跳过，完整生成、类型、语言/样式、前端与官网构建等；明确共享工作区范围及真实模型验收边界。
- [Intel 预检](intel-preflight.json)、[依赖缓存](dependency-caches.json)：同源预检首次成功，21 分 02 秒；只建立依赖缓存，不将预检安装包用于发布。
- [原始候选所有权](prepare-owner.json)：实际观察同源空草稿及标签，绑定唯一正式运行。
- [正式结果](release-result.json)、[原生运行](native-run.json)、[准确配对官网](website-run.json)：正式运行 46055484785 为 23 项成功/6 项条件跳过，官网 46058325681 八项成功；包括实际安装包校验、13 条首次运行/重启回执、发布者返回的官网编号及官网解析的准确产品来源。
- [正式 Intel 证据](intel-proof.json)：实际命中依赖缓存、原生重新构建与首次运行；没有把缓存命中当成功验收。
- [公开读回](public-readback.json)、[18 个公开下载](public-downloads.json)：最新版本、冻结日志、29 项上传对象、真实完整性清单、五平台稳定更新及官网清单一致；18 个实际下载请求跟随公开重定向后返回 200。
- [发布前库存](release-inventory-before.json)、[发布后库存](release-inventory-after.json)、[候选结清](cleanup.json)：31 个既有对象事实保持，增加本版后共 32 个；唯一候选首轮成功，没有失败版本删除操作，92 条实质历史日志保留。

## 实际公开包与人工视觉复核

[公开 Windows 归档](published-cli-asset.json) 实际下载 146243069 字节，资源身份与上传对象完整性一致；以此归档的可执行文件启动自有隔离空实例。[运行记录](published-ui-runtime.json) 与[系统结清观察](published-ui-settlement.json) 记录真实版本、准确进程树、正常关闭响应 200、进程退出、端口释放及临时目录删除。真实模型预算零、没有凭据移交、没有发送消息或启动目标；请求传输未装载计数器。

以下截图均通过真实页面操作后亲自查看；未运行界面自动化测试。官网两语言版本、日期、各分类、正文和限制正确，公开包设置中的首尾截图有重叠且覆盖完整日志。

| 页面 | 英文 | 简体中文 |
| --- | --- | --- |
| 公开官网详情 | [全文](website-en-US.jpg) | [全文](website-zh-CN.jpg) |
| 实际公开包设置日志顶部 | [顶部](published-settings-en-US-top.jpg) | [顶部](published-settings-zh-CN-top.jpg) |
| 实际公开包设置日志尾部 | [尾部](published-settings-en-US-end.jpg) | [尾部](published-settings-zh-CN-end.jpg) |

原生首次运行使用受控 Provider（模型服务提供方），`realProvider=false`；并不证明全部真实模型或全部产品操作通过。本轮普通持续集成的审计、验证、客户端服务作业成功，三平台完整后端作业被共享主线后续推送替代而取消，不能将其写成全量持续集成通过。macOS 安装包仍未公证，Office 与图形导出的既有范围限制见该版双语更新日志。
