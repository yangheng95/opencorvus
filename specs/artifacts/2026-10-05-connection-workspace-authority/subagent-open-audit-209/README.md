# 209 主卡片 Open 的真实操作调查

## Recall

用户要求自主持续迭代 Sources/子侧栏体验，最新只用单agent。当前0945cff3已推送、工作区干净。上一批208一次定位点击未显Dock，旧105同类pointer观察也保留；本轮 [调查方案](../subagent-open-investigation-209.md) 先区分屏幕外自动定位与真实屏幕内指针/键盘操作，不按未证明的根因修改产品。

完整原153 runtime新副本90表实际行内容一致，原Task/Project/Session保持：[准入](../subagent-open-startup-209.json)、[复制](live-01/subagent-open-audit-209-01-history-copy.json)、[实际生产服务HTTP](live-01/actual-http-readiness.json)，当前 `/ui/assets/main-L1F0igr8.js`200。没有凭据、Provider新请求、原Task重置、UI自动化测试或生产源码修改。

## 实际观察

| 操作 | 可验证事实 | 证据 |
| --- | --- | --- |
| 首次Task尾部 | taskSwitch=false、top1302/follow=true；researcher按钮y=-514.0625，tester=-316.729187，在屏幕外 | [事实](live-01/initial-main-facts.json)、[截图](live-01/initial-main.jpg) |
| 原屏幕外定位点击 | 同tail/follow、按钮仍屏幕外、Dock width0，原现象复现 | [事实](live-01/automatic-scroll-click-facts.json)、[截图](live-01/automatic-scroll-click.jpg) |
| 实际滚轮up1 | top582/follow=false，researcher按钮y205.9375、tester403.270844，截图可见 | [事实](live-01/manual-scroll-before-click.json)、[截图](live-01/manual-scroll-before-click.jpg) |
| 屏幕内指针Open researcher | 正确base-researcher完整Dock正文，实际规范session读取200 | [立即截图](live-01/manual-pointer-open-immediate.jpg)、[观察](live-01/manual-pointer-open.json)、[生产HTTP](live-01/subagent-open-audit-209-01-http-summary.json) |
| 关闭后键盘Enter tester | ses_hmr5hLvn696a1dvBqrh0/top444.666656/height1021/client577/follow=true | [事实](live-01/manual-keyboard-open.json)、[立即截图](live-01/manual-keyboard-open-immediate.jpg) |
| 关闭后屏幕内指针tester | 同规范tester session打开，follow=true | [点击前](live-01/tester-before-pointer.jpg)、[事实](live-01/tester-pointer-open.json)、[截图](live-01/tester-pointer-open.jpg)、[完整起点](live-01/tester-open-top.jpg) |

上述截图均由负责者亲自查看；观察JSON不是自动化测试。两个真实按钮在可见/主follow释放时pointer通过，tester keyboard通过。主卡与活动栏走同一个规范打开入口，当前没有代码/真实页面证据支持给可见Open加生产补丁。共享测量在follow=true时会落尾，与自动定位点击仍在tail一致，但工具内部事件发送时序未测，因此不宣称已定位它的内部root（根因）。原105/208失败保留，不以本轮替代全部点击、冷加载、流式或键盘自动滚动矩阵。

## 结算及后续

自己的页面24已关闭，另一个非本轮页面未操作。原父工具53393退出0，[原生产Native joined](live-01/subagent-open-audit-209-01-launcher-native-joined.json) 21:47:10.638Z为exited/0且physical/output/request完整；[独立闭合](live-01/subagent-open-audit-209-01-independent-closure.json)证明精确Host76764/Target13680出生身份死亡、18129/pair关闭，deadline1791496726470内自然结束。原153未重启。

仅本轮5份原生FFI（Foreign Function Interface，外部函数接口）观察器调试文件按精确出生时间及工作区边界移至私有临时目录，[移交记录](generated-native-observer-custody.json)保留，未递归清理整个目录。文档检查345ops/25groups通过。

本轮只增加真实体验证据与修复优先级判断，没有推测性UI改动。下一批需使用完整auth/models pair（凭据及模型目录）在当前Host下做授权GPT-6.1 Sol单Chat流式来源/正文场景；没有创建子agent。无凭据历史页面的配置提示不代表用户auth异常，不能作为模型验收。
