# 283 长章节下可见的来源网站

[实施前Recall](../source-provenance-plan-283.md)。持续单agent；本轮未创建Task、成员或委托。开始4485b0f39已推送且工作区干净。

## 根因与修复

[282实际前态](../source-tooltip-282/live-04/02-first-return.png)中，长章节占满位置的两行，后置的域名因此完全被截断。281为区分同标题章节把hash放在host前，破坏了此前来源网站常驻可见的效果。完整Tooltip可查看，不能替代折叠时的网站辨识。

本轮只在共享SourceParts.location将顺序改成host再hash，继续使用原两行限制。三个使用者Main/Side/子会话仍消费同一组件，可访问名称仍派生同一位置串；实际Source URL、身份、工具结果、原章节及Tooltip未改。没有增加URL解码规则、私有样式或第二状态源。

## 真实页面结果

独立正常dev/ui18230，当前bundle `main-BfOrDdlz.js`。[三来源截图](live-01/01-sources.png)显示短章节examples、technical_summary仍各自可辨，长章节的developer.mozilla.org完整显示在截断前。Root人工查看截图；没有用DOM文字断言、快照或像素分数替代视觉判断。

[完整提示](live-01/02-tooltip.png)可用原生Tab打开。提示覆盖第二Source时，一次正常鼠标点击实际打开MDN技术摘要页20，[导航事实](live-01/03-navigation.json)保留真实目标#technical_summary。点击后第一条页面清单尚未包含新页，下一条清单包含20；没有重复点击或把初始清单当失败。

关闭自己资料页20、回到19后首次两次Tab，[完整提示继续显示](live-01/04-return.png)，同时保留长来源域名。Escape后[提示关闭而来源仍清楚](live-01/05-dismiss.png)。当前正常桌面两个实际浏览器视口均人工查看，没有设置响应式断点或更改用户外观。最后关闭自己19，浏览器清单空。

## 真实数据与收尾

沿用成熟NativeService，固定600000ms/12累计请求；授权auth及完整models成对，启动前credential usable、catalog projected、actualModel gpt-6.1-sol且streaming true。实际3个webfetch工具输入与3条持久化URL逐一对应原request.txt，包括完整章节；3个工具结果均completed，7个Provider源reader EOF、0取消。[后端事实](actual-source-facts-01.json)仅证明这些实际数据，不是UI自动化。

唯一shutdown实际exit0，原前台19994实际join exit0。Native50532/出生639272897422767716，Host12352/出生639272897415052294。独立closure读取精确出生/物理输出请求终态、18230释放和复制auth/models退休；物理结束时余481014ms，满足提前四分钟目标。随后归档完整脱敏Canonical/日志/Provider事实，所有实际工具结束后才按出生/限定单文件路径保管5个自产物。

一次编排shell在PowerShell脚本后读取未设置的LASTEXITCODE，提前exit0，未执行后续archive/facts；发现输出仅有closure后，按原实际状态单独运行archive/facts，actual0且取得4368行日志和真实事实。该工具调用不曾被当作已完成归档，未重启服务。

## 验证与边界

正常build79534 actual0（52.55秒）、overlay类型56501 actual0。docs:check345ops/25groups、architecture-index18文档当前通过。没有新增或运行UI自动化，也没有为纯顺序显示写后端镜像测试。检查日志及使用的归档/事实/闭合辅助代码保留于本目录。公开文本的行尾空格统一清除，私有原文保留；图片和结构化事实保持原样。

本轮没有修改Rendering实现。当前TextPart/model/worker和子Dock所有权已读，未取得新的闪烁复现证据；原Research Studio旧schema、原子侧栏全帧Rendering与未采样宽度仍未验，不能用本轮Main Sources替代。持续目标保持active，范围提交并正常推送后继续。
