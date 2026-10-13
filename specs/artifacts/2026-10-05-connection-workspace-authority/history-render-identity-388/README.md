# 388 参考历史重连身份

[方案与Recall](../history-render-identity-plan-388.md)。单agent完成真实修前/修后侧聊、限定连接中断、来源打开和人工截图复核。产品仅将 SideChatPanel 参考历史由对象身份的 For 改为按 messageID 的既有 Key，并从 accessor 读取当前数据；当前消息、Markdown、Provider、Source、重试和错误协议均未改。

## 观察与根因

普通消息追加由既有投影保留未改对象，不能据此声称每个token重建历史。真实session.connected重连快照产生新包装对象，历史For因对象身份卸载了同一消息。before连接97中断后123/200接续，继承消息owner1/2/3在12:16:13 UTC退休并由6/7/8替代，当前消息4/5保持；after连接102中断后114/200接续，同ID历史owner1/2/3与当前4/5持续到观察结束。[被动时间线](lifetime-observations.json)只描述实际日志，不做UI自动化断言。

- [修前重连](before-reconnected-history.png)：真实参考历史和Sources仍有内容，原传输错误显示。另两张before-selected-history截图只是选择尝试，原生selection均为空，不能称为丢失选择。
- [修后焦点](after-focused-source.png)与[修后重连](after-reconnected-focus.png)：继承Source按钮保持原键盘焦点，折叠布局和正文保持；传输错误仍诚实显示。
- [修后直接回车打开来源](after-source-open.png)：来源材料/方案甲.txt，价格120、交付3天，第2—3行高亮。主agent实际查看上述截图，没有UI测试、快照/像素断言或DOM自动验收。

## 实际运行

[后台规范checker结果](runtime-review.json)核对三条继承Message/Parts/Tool内容持续，原/复制Source各自绑定自己的Message和Tool，第2—3行及原完成回执正确。每scope在启动任务前验证凭据usable、目录projected、实际gpt-6.1-sol streaming；各8次请求均200/EOF，计入同进程20请求预算，包括preflight和helper。

before Target23560/Host83936，489517ms正常退出0；after Target84944/Host86968，533089ms正常退出0。两次固定600000ms资源界限内，Native Job/output/request、精确进程与监听先收敛，再清理复制auth/models。页面6/7已关，Native launcher28741/27366、代理19605/42690和after关闭helper87772均实际join exit0。

透明代理只转发真实/ui与接口字节，明确关闭一条已存在Side SSE，不合成消息/响应。before代理37980退出0，但最后日志在socket close回调前记为sockets1；保留原事实与原脚本。after辅助工具补上全部socket关闭等待，68516退出0并记录sockets0；这属于验收工具回执修正，不是产品网络修复。

## 检查与边界

类型检查、修后私有诊断构建和无观察代码的正式构建均exit0；正式构建main-QSwgWIyk.js，1m11s。私有构建仅在内存加只读生命周期日志；正式源码未加入观测代码。正式压缩产物未另开第三次页面验收，截图来自同一产品代码加被动日志的真实服务。构建chunk-size与第三方use-client提示保留，未当失败或视觉结论。

最初诊断build插件顺序错误已修复并重跑，原失败日志保留。一次浏览器观察表达式语法错误发生于动作前；before选择未建立。原All agents成员侧栏Rendering占位未在本轮复现，暖缓存没有拍到占位闪烁，因此本轮只交付侧聊参考历史身份修复。386原fetch_failed仍属于原失败scope。没有版本发布。

完整脱敏输入、规范事实、被动日志、运行回执、脚本和实际主bundle收录于checks；压缩解压完整字节核对只证明归档完整性，不能替代功能或视觉验收。

docs:check与check:architecture-index通过。298份完整归档解压核对通过，302份完整文本/归档凭据扫描为0；原自有PID再次读取均已结束，18409—18412监听已释放。
