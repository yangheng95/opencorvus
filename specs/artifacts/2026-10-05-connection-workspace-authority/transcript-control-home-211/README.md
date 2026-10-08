# 211 原生 Ctrl+Home/End 阅读意图修复

## Recall 与真实根因

用户持续要求自主修复Sources/Rendering/功能，最新单agent。210结束后键盘返回未响应，本轮 [实施前方案](../transcript-control-home-plan-211.md) 先读取共享控制器/三调用者/当前架构，按同一真实焦点对照modifier（修饰键），未通过改变焦点遮蔽问题。

原代码onKeyDown对任意ctrlKey返回：浏览器原生Home/End导航缺少上/下意图归属，跟随中的内容测量把Ctrl+Home上移重新拉尾，Ctrl+End到尾不能重新跟随。真实Main activeElement=DIV#chatScroll/nearest owner=chatScroll，旧Ctrl+Home即时像素向上但稳定top1302/followtrue；普通Home同焦点稳定top0/followfalse。旧Ctrl+End稳定top1302/followfalse；child实际来源A焦点上Ctrl+End也到尾followfalse。这些事实结合唯一控制流排除本次焦点归属猜测。

只改共享modifier条件：Ctrl Home/End进入已有方向识别，其他modifier/defaultPrevented/编辑控件和最近owner保护保持。没有preventDefault、全球键盘代理、新滚动实现、焦点迁移、接口兼容或后备路径。Main、Side Chat、child沿用同一控制器；现行合同更新[07](../../../current/architecture/07-panel-reactivity.md)。

## 真实页面对照

| 场景 | 原观察 | 当前观察 |
| --- | --- | --- |
| Main Ctrl+Home | [稳定事实](live-01/main-old-control-home-stable.json)/[像素](live-01/main-old-control-home-stable.jpg)：top1302/followtrue | [稳定事实](live-01/main-new-control-home-stable.json)/[像素](live-01/main-new-control-home-immediate.jpg)：top0/followfalse |
| Main Ctrl+End | [事实](live-01/main-old-control-end-stable.json)，top1302/followfalse | [事实](live-01/main-new-control-end-stable.json)/[像素](live-01/main-new-control-end-immediate.jpg)，top1302/followtrue |
| Child来源A上的Ctrl+End | [实际焦点](live-01/child-old-source-before.json)/[稳定结果](live-01/child-old-control-end-stable.json)，top2349.333251/followfalse | [稳定结果](live-01/child-new-control-end-stable.json)/[像素](live-01/child-new-control-end-immediate.jpg)，同尾部followtrue，Main保持true |
| Child同焦点Ctrl+Home | 原缺口保留 | [稳定结果](live-01/child-new-control-home-stable.json)/[像素](live-01/child-new-control-home-immediate.jpg)，child0/false，Main true |
| TEXTAREA编辑caret（插入光标） | window.getSelection不能代表该控件光标 | [Home](live-01/editor-control-home-caret.json)/[End](live-01/editor-control-end-caret.json)/[像素](live-01/editor-control-end.jpg)，光标0→39，main top/height/follow保持；自己的未发送草稿清空 |
| 最终Sources阅读 | 同规范ses_hMlVNrRdOLxQf4XhSds7 | [事实](live-01/final-source-keyboard-top.json)/[完整Tooltip像素](live-01/final-source-keyboard-top.jpg)，child top0/false、首Source展开，Main true |

截图全部由负责者亲自查看，DOM（Document Object Model，文档对象模型）JSON为真实观察，不是UI自动化断言。第一次child屏幕外定位summary后active为Tool按钮的原截图保留，不作为来源A对照；真实up4让Source可见后才采到规范URL焦点。Textarea弱selection观察保留，真实selectionStart/End才用于caret结论。

## 编译、运行及闭合

当前类型工具81935退出0，构建19855退出0/52.78s、renderer public surface检查1/1。[原HTTP准入](live-01/actual-http-readiness.json)保留基线main-L1F0igr8；[最终实际HTTP](live-01/final-asset-http.json)及[当前生产日志](live-01/transcript-control-home-211-01-http-summary.json)记录main-ChaFi5sr200。没有以build/types或静态字符串代替视觉，没有新增/修改/运行UI自动化测试。

当前主分支0af8028a后台未变，完整原153 runtime新副本通过[全90表真实行内容一致](live-01/transcript-control-home-211-01-history-copy.json)及[准入](../transcript-control-home-startup-211.json)。Run `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/transcript-control-home-211-01`，port18131，原固定deadline1791498621663。没有新模型请求或凭据移交；隔离历史页配置提示不是用户auth异常。

自己的page26关闭，非本轮page23未操作。原父工具20951实际0，[生产Native joined](live-01/transcript-control-home-211-01-launcher-native-joined.json)为22:23:30.658Z exited/0且physical/output/request完整，[独立闭合](live-01/transcript-control-home-211-01-independent-closure.json)确认精确Host72896/Target42916出生身份死亡、18131/pair关闭；期限未延长。原失败/preimage保留。

仅本轮5份FFI（Foreign Function Interface，外部函数接口）调试文件按精确出生时间和绝对工作区边界移入私有目录，[移交记录](generated-native-observer-custody.json)保留；没有清理其他任务文件。文档检查345ops/25groups通过。

Side Chat真实同键、其他平台/Meta/Shift组合、更长CtrlEnd动画与本次修复后的实际流式仍未独立验；210旧版本流式资格不替代这次键盘补丁的流式矩阵。持续目标进行中，单agent继续。
