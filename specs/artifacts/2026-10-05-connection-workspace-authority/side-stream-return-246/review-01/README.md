# 246 review-01 草稿修复真实复测

own IAB87/18180，新独立600000ms/12请求，不是原live-01重启。真实资源main-D_-2LIPy.js。Main `ses_-zUSQFNyjzz2DYM555kc`296字符、search2+fetch1 Source3；包含搜索返回的Contributors页，这是实际模型结果，不更改为期望4来源。Side `ses_-zUSQFCenzzHVG5fqCm1`继承4消息/3来源，新User `msg_a8599619-a7d0-43ca-bca3-819032f50361`233字符，Assistant `msg_g0VXZksaT00cG6P8dCjf`3524字符。

| 图片 | 实际UTC时间 | 人工复核范围 |
| --- | --- | --- |
| side-accepted.jpg | 17:47:11.430 | 真实User/Working/Stop，compact composer |
| side-before-close.jpg | 17:47:37.398 | 运行中已有851显示字符/1编译块/749 live tail |
| side-reopened.jpg | 17:47:50.907 | 同SID/Message只13字，从第6节中段开始；原prefix恢复失败再次出现 |
| side-terminal.jpg | 17:49:04.060 | 完整回复/代码显示、空输入与正常status，原草稿已清理 |

17:47:37.804关闭后Side DOM absent。17:48:11.191当前SQLite readonly BEGIN/ROLLBACK看到同一真实open Assistant/Part，canonical textChars=0；源reader到17:48:28.559才最后读字节。证明UI正在追加文本但连接快照的canonical Part确实仍空，shared backend prefix bug未被草稿UI修复掩盖。

terminal geometry：value空/disabled=false、textarea72/composer135/reading388.333；同Assistant6编译块/3253显示字符。12段+5行表格可由当前AX/原正文佐证；本次截图人工主要看代码/空输入，不把AX当作表格视觉验收。Reference打开那次AX已经显示全terminal及空框（late于EOF），虽操作标题说过程中，本次不宣称新的stream中Source阅读。

Native78328/Host77880、occurrence `side-stream-return-246-review-01-0d399f6e-5a5d-40ed-9edc-89ca94e72fbe`，17:49:14.917 exited/0早于17:55:31.915；fore97710 actual0、全部9/12 Sol streaming200/source EOF、exhausted=false、pair和完整chain/独立closure0。8502实际日志unknown0、当前production Tool输出resolver元数据与完整canonical归档，所有observer终态后5个自有Bun文件精确归档。

本次成功只证明面板dispose后同authority/未改稿/原HTTP成功的草稿清理。error、引用/文字改变、API切换、浏览器full reload、新旧同字不同Message ID以及全部Rendering帧/原research子侧栏仍未逐项实跑；保留精确ID/text守卫且不扩大结论。
