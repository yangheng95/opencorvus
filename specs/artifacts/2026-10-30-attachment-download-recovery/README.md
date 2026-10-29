# 附件原件失败与局部恢复

2026-10-30，单agent，真实开发服务 `/ui`、内置浏览器、截图人工复核。UI（User Interface，用户界面）验收没有使用自动化测试。用户18571应用与真实数据库保持原样。

## 修复与原始现象

展开一份真实历史附件时，原件读取404会让 `OriginalFileDownload` 直接读取失败的 Solid resource，异常进入外层消息卡片错误边界。整张用户消息变成 Card render failed，原文和附件入口消失。恢复文件后卡片仍无局部恢复入口。

当前下载组件先处理自己的资源错误，使用已有 Feedback 显示诊断与“重试下载”；文本预览的已有错误反馈增加“重试预览”。两者各自 refetch 当前 source 与捕获的 API（Application Programming Interface，应用编程接口）权限，仍使用同一个现有 Blob 缓存和请求去重。下载链接继续只指向成功取得的原件字节。

依据当前 Solid1.9.13 `read()`/`load()` 实现及[官方资源合同](https://docs.solidjs.com/reference/basic-reactivity/create-resource)，失败访问和显式重读应由当前消费者处理。没有增加备用原始URL、卡片reset、新缓存或第二错误状态；HTTP（Hypertext Transfer Protocol，超文本传输协议）原始404诊断保留。公共后端接口、模型、工具和schema均未改变。

## 实际页面

| 原图 | 实际结果 |
| --- | --- |
| [01 原历史](01-before-collapsed.png) | 原User正文、附件和历史模型回复完整。 |
| [02 原故障](02-before-card-render-failed.png) | 展开缺失原件后整张User卡片失败，模型回复保留。 |
| [03 原件已归还](03-before-original-restored-card-still-failed.png) | 实际GET200且原字节相同，旧卡片仍失败。 |
| [04 候选局部错误](04-after-local-errors.png) | 相同404下保留原User正文、附件和两个明确重试动作。 |
| [05 缺失时再重试](05-retry-while-file-missing.png) | 再次404仍保持局部反馈；实际Tab继续到Copy message。 |
| [06 原页恢复](06-original-preview-recovered.png) | 同一原件恢复后实际重试，JSON正文与下载恢复。 |
| [07 发送前错误](07-composer-local-errors.png) | 实际文件选择器暂存的文本原件缺失，正文/页脚错误与Close均可见。 |
| [08 发送前恢复](08-composer-recovered.png) | 同一35字节原件恢复并分别重试，完整正文和下载恢复。 |
| [09 二进制错误](09-binary-local-error.png) | 普通未知类型下载chip保持自身错误，不破坏对话框。 |
| [10 二进制恢复](10-binary-recovered.png) | 同一4字节原件恢复后重试，实际下载逐字相同。 |
| [11 草稿清理](11-draft-attachments-removed.png) | 两个附件经实际Remove控件移除，焦点回消息输入框。 |
| [12 中文缓存命中](12-chinese-cached-preview.png) | 实际命中此前成功资源的浏览器缓存，只证明中文阅读，不能当作错误态。 |
| [13 中文真实错误](13-chinese-real-errors.png) | 新暂存中文原件首次读取实际404，提示、重试、Details和Close均按当前语言。 |
| [14 中文恢复](14-chinese-recovered.png) | 同一原件恢复后实际点击两个重试，正文与下载恢复；关闭回原trigger，移除回输入区。 |

全部暂时移出的文件只属于本scope的复制namespace或真实暂存上传；原namespace/消息/URL/Part未修改，结束前全部归还。没有刷新页面来冒充局部重试。对历史文件的中文错误试验曾命中浏览器缓存，随后用新的真实暂存中文文件补齐，保留两次事实。

三份实际浏览器落盘文件：历史JSON70字节、暂存文本35字节、二进制4字节，逐字等于相应原件，见 `download-*.json`。另一个中文35字节文件验证恢复后的下载入口，没有宣称第四份实际下载。

## 数据与运行核对

[逐行与文件核对](data-qualified.json)：源库203936行精确保持；before/after各203938行，其中203936条旧记录全部相同。均为schema9，完整性和外键通过。每个复制库仅新增一个本次 `runtime_process` 身份收据与其ordinal1 grant；[独立核证](runtime-leases-qualified.json)绑定真实runtime occurrence、原生PID/出生身份、实际退出及当前OS的dead_or_reused。其MAX_SAFE_INTEGER是 `joinProcessLiveness` 保留物理身份的存储表示，物理进程观测决定存活，不是仍有等待执行。

六处附件17/10/16/24/6/2共75文件在两个复制namespace逐字保全。三个QA（Quality Assurance，质量验证）仓库的16份tracked文件、HEAD、ref、暂存语义与working内容保持；原793失败历史未改。三个本轮真实暂存输入均已恢复，并通过界面移除草稿，未发送消息。

两个scope共用启动前固定的45min绝对截止，实际无活动阈值180s、当前唯一诊断shutdown预留5min。baseline原exec15198与candidate原96524均已公开shutdown200、native/launcher0，物理/输出/请求结清且精确出生身份退休，认证与完整模型目录副本均已退休；原目录字节/metadata及原认证metadata保持。两阶段均0模型请求，累计仍1083；配对认证和目标Sol只做本地投影，不冒称新的实际模型预检。

候选 `main-DIncBPIS.js` 普通构建、类型检查、两语言2627键、样式合同8937引用/2文档，以及当前文档检查351操作/26组均通过。五份原始检查日志按UTF-8原文无损编码到JSON，类型/构建没有代替上述实页验收。

准备器曾错误假定原件91字节（实际70），并因整库deepEqual比较SQLite二进制的JSON表示而展开巨大诊断；保存旧快照、精确停止自有准备进程后，改为逐表原值序列化核对并完成。原中断回执与[方案/Recall](../../records/2026-10/2026-10-30-attachment-download-recovery.md)保留；不把准备器故障当产品缺陷。凭据、模型目录、完整数据库和私有整库行均未导出。

本轮交付覆盖原件404及恢复、历史文本、发送前文本和普通二进制、中英文操作。其他媒体分支已有独立错误守卫，本轮未逐一重测，未扩大为所有文件类型验收。持续产品迭代仍为active。
