# 同文档事件流断连与恢复：真实证据

[调查、实施前方案与局限](../../records/2026-10/2026-10-22-native-stream-reconnect.md)。一个开发agent，正式main-B1unUUgO/原Source CLI（Command Line Interface，命令行接口）开发/ui，生产源码未改。独立历史0模型和活跃15次真实Sol场景，页面和服务进程均在故障前后保持运行。

## 原始事实与结果

| 证据 | 结论及实际范围 |
| --- | --- |
| [事件、cursor、Message/Part、原reader时段](result-observation.json) | 两scope各只有一次真实/ui document请求；历史同PID88712、活跃同PID81944和原native occurrence。切断前后的真实stream instance、请求ID、目录、durable/live query与200响应完整保留。 |
| [原生校准](calibration.json) | 200/29635字节后单请求idle timeout1触发实际request abort，原HTTP（Hypertext Transfer Protocol，超文本传输协议）reader在3.697秒得到TypeError ECONNRESET，自己的20秒上限未到。 |
| [透传响应故障校准](live-calibration.json) | 正常原gzip字节经过identity TransformStream；受控controller.error后67毫秒内实际ECONNRESET和原上游pipe取消完成。没有合成/改写SSE（Server-Sent Events，服务端发送事件）数据。此模式原Request.signal没有abort记录，不能冒充原生request abort。 |
| [历史可见前](historical-before-visible.json)、[后](historical-after-visible.json) | 原B/ACL、5810可见字元、scrollTop0/height6716/client576保持；原页约3.5秒从after41/live0重开200。 |
| [活跃可见前](live-before-visible.json)、[后](live-after-visible.json) | 原ZbdA会话4606→5700可见字元，沿底部跟随；第七节继续到完整结尾。后图已完成，不把它当重开后每个token的连续观察。 |
| [活跃原时段/最终持久消息](result-observation.json) | 切断18:14:01.247Z，重开18:14:04.263Z，cursor after21/live6915/epoch1792606202150。B原msg_g0VYi1Y1X00i6mOc3Trn到18:14:17.753Z才完成，原source reader覆盖切断/重开；最终正文Part prt_g0VYi1ZRj00C20b9Msd7为5461字元，原状态Part91字元。 |
| [真实预检](live-preflight-ready.json)、[原Task输入](live-task-create-request.json)、[202结果](live-task-create-response.json) | 凭据usable、完整catalog projected、实际gpt-6.1-sol stream=true后才创建tsk_g00VYi18zf00L6NKm1vM。原Task自然completed、pending/unfinished/Task prompt owners均0；全部15/32请求200/流式/原source EOF（End Of File，流结束），条件review未启用。 |
| [全量原数据核对](data-preservation-observation.json) | 两scope源90表156566原行/字段/身份/时间、source bytes/mtime、schema3/实际对象/integrity、完整五键canonical保持。历史无差异、activity391→391；活跃仅三条容量租约正常更换原字段，activity391→400，新真实事实保留。 |
| [历史原物理结算](historical-physical-terminal.json)、[活跃原结算/配对退休](live-physical-terminal-and-pair-cleanup.json)、[私有配对退休](live-authority-retirement.json) | 原5291/7582均exit0、公开shutdown200、native physical/output/request/launcher/精确出生全部结束；98/99页关闭，四个auth/models副本退休。实际秘密值扫描155文件/118681451字节0命中，原授权/catalog保持。 |

记录时间为UTC（Coordinated Universal Time，协调世界时），截图为用户当地时间。可见文字长度包含控件/标题/来源，不等同纯正文；没有DOM（Document Object Model，文档对象模型）或长度断言作为UI（User Interface，用户界面）验收。

## 七张人工查看的截图

| 图 | 人工复核 |
| --- | --- |
| [01 历史断流前](01-historical-before-disconnect.png) | 原B来源、正文和阅读位置可见。 |
| [02 历史恢复后](02-historical-after-timeout.png) | 同一文档/目标/来源保持，无页面刷新；零模型提示符合此隔离scope。 |
| [03 活跃原审批](03-live-dispatch-permission.png) | 原模型产生两项独立来源责任，真实Allow Once；各网络读取另经审批。 |
| [04 活跃断流前](04-live-before-disconnect.png) | B原文未完成。点击第二节后仍自动跟随到底部，未取得暂停阅读资格。 |
| [05 活跃恢复后](05-live-after-disconnect.png) | 同一ZbdA、原长文增长并到结尾；没有重新生成消息。 |
| [06 恢复后来源](06-live-source-after-reconnect.png) | 原ACL标题、域名、入口与自己的状态/正文保持。 |
| [07 最终尾部](07-live-final-tail.png) | 原LIVE512B_END、原两成员卡及Completed可见。 |

截图和真实交互全部人工复核，没有UI自动化、DOM/组件/文案/快照/像素断言。没有连续帧观察、带Authorization的fetch分支、独立Work/Mission或原生WebView2资格；不把此受控真实网络错误称为自发生产事故，也不据几张截图宣布所有瞬时Rendering消失。

## 实际诊断缺陷与修复

实际live观察器在校准nonce已消费、目标改为新Task后仍先检查当前Task，产生726条重复控制AssertionError。结果文件保留计数及首尾原错误，完整原日志留私有；这可能增加运行时负载，因此本轮不作性能或帧级结论。保存[历史实际v1](historical-network-observer.ts)、[活跃实际v2](live-observer-used.ts)，避免把磁盘修订冒充原运行代码。

当前唯一[观察器](network-observer.ts)使用[动作判定](network-action.ts)，已消费指令先返回retired receipt，待执行指令才验证当前目标及模式。[两个聚焦后端正向合同](network-action.test.ts)先以原顺序复现[1失败/1通过](guard-before.log)，修正后[2通过](guard-after.log)。这是控制器局部合同，真实HTTP/页面验收另有上述原始证据；修复后未追加模型Task或宣称额外端到端通过。Bun两次打印的“Owned diagnostic HTTP response stream interruption”是校准/真实断流的故障原因，原服务仍exit0，不作为生产异常。

故障方法依据[原生请求超时接口](https://bun.sh/reference/bun/Server/timeout)、[HTTP流超时合同](https://bun.sh/docs/runtime/http/server)和[WHATWG Streams错误传播标准](https://streams.spec.whatwg.org/#ts-default-controller-error)。运行器为自有故障调查工具，保留原Response字节到切断时；业务路由、消息、模型请求和唯一重连所有者均为产品现有实现。

完整数据库、全库dump、模型目录/授权及完整prompt日志不归档。运行器源码快照依原仓库路径放置；shared-native-model-serve/shared-native-host保存实际共享入口，不是可直接从artifact目录运行的发布包。用户18571/真实数据库未操作，无schema/迁移、清库、版本或Release变化。
