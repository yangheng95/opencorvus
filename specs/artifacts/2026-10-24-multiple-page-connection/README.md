# 多页面连接与持久历史读取

558，单agent，真实Source CLI /ui、桌面截图逐张人工查看。[完整非秘密证据](evidence.json)，[原请求到达/abort记录](before-requests.jsonl)、[中间](intermediate-requests.jsonl)、[最终](final-requests.jsonl)。没有UI自动化测试。

| 实图 | 实际资格 |
| --- | --- |
| [01](01-single-page.png)、[02](02-two-pages.png) | 2/4条事件流时原Task Online、历史可读。 |
| [03](03-third-page-blocked.png) | 六流时Connecting、输入disabled，原正文Rendering。 |
| [04](04-third-page-recovered.png) | 关闭一自有页后，原页无需刷新恢复Online/原正文。 |
| [05](05-task-chat-side.png) | 不同项目Task、Chat和既有Side的五流组合正常。 |
| [06](06-mission-blocked.png)、[07](07-mission-link-details.png) | Mission页global流占第6连接；另有GET Session模型初始化400，不把它算作网络恢复失败。 |
| [08](08-chat-side-recovered.png) | 释放连接后Chat/Side原正文保持、Online；AX增量未重复稳定状态，以实图为准。 |
| [09](09-session-only-fix.png)、[10](10-second-read-boundary.png) | 中间修复仅Session GET200，Mission status仍400，明确未通过。 |
| [11](11-mission-history-visible.png)、[12](12-task-history-visible.png)、[13](13-mission-with-task.png) | 完整修复后，同一无认证环境中Mission四条历史和已完成Goal可读，另项目Task双页Online。 |

六流时两个窗口分别42343/35750ms没有普通浏览器请求到达，独立health为200/95.9194ms与200/114.0671ms。第三页Markdown worker在释放页后56ms到达，支持Rendering等待资源的因果链。HTTP连接额度依据[MDN说明](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)；当前流实现仍待修复，关闭页只是诊断干预。

本次实际交付是共享持久历史读取准入修复。裸Session详情及Mission status原先触发可执行初始化/模型校验，现使用既有Project身份与父链检查；Session列表、children、todo、turn-artifacts及Mission活动游标同源纯投影一致，执行/config/删除合同保持。10项正向合同/88断言通过；没有schema、API字段或版本变更。

三个服务公开shutdown200、原exec69544/10698/87275及native/launcher均0、physical/output/request/精确出生闭合；余量416081/1073463/1071903ms。0模型、不复制auth、三份catalog退休，源内容mtime保持。三个源90表169304原行全部字段时间/源文件/canonical保持，三个目标原行零差异，schema3实际对象/integrity保持，provider_activity_request421→421。所有自有页198—204关闭。
