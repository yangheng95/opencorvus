# 220 来源实际激活

[实施前Recall](../source-navigation-plan-220.md)、[当前安全前沿](../source-navigation-readiness-220/README.md)、[实际startup](../source-navigation-startup-220-before.json)。本轮无生产改动，无新agent委托、Task重跑、模型请求或凭据移交。

## 当前真实结果

自有IAB36 http://localhost:18141/ui/，实际main-Bmeb8tJo/HTTP200；完整原153 Task与原researcher身份/目录保留，90表copy直接完整行相等。原真实Source href、target/rel null记录在[激活前事实](before-01/source-before-activation.json)及[基线截图](before-01/source-before-activation.jpg)。实际点击后，36原Task/child/Sources仍完整，[同一对话截图](before-01/source-activation-held-conversation.jpg)人工查看；新37对应真实WAI页，[真实目标页面](before-01/source-target-real-page.jpg)人工查看。原记录JSON名source-activation-result保留，location仍localhost/ui，不能以预期或截图命名猜根因。

host-transport.ts browser open-url=true，main.tsx的既有listener交给nativeOpen；tauri-transport.ts browser路径验证URL后同手势window.open(_blank,noopener,noreferrer)。源码及实际行为排除本轮候选的当前浏览器根因。Source Parts漏target并不等于当前产品替换对话；本轮不增加平行导航规则。after18142未启动，无修复后资格；标准Chrome、Native Tauri、新child流式、片段和更多矩阵未覆盖。下轮转查file Source身份辨识度，不用此成功替代它。

## 闭合与数据

自己36/37已关，用户23未动。唯一public shutdown，原foreground session10589 exit0。[生产Native结算](before-01/source-navigation-220-before-01-native-host-settled.json)01:58:53.532Z exited0/physical-output-request全true，早于固定deadline1791511889763，未续时或重启。Host77852/Target23828独立永久出生身份dead_or_reused、18141无listener、auth/models absent。当前日志canonical窗口与未知timestamp分开归档。

[最终直接完整行事实](before-01/final-canonical-custody.json)13表相同：Session5/Message22/Part59/Tool request14-progress0-outcome14/Provider request17-outcome17-usage19/Task1/descriptor2/artifact10/version0。两个原Project44/97属性相同，属性不是文件内容完整性。docs检查、范围提交与push按当前仓库要求执行；持续单agent目标active。

当前docs:check实际exit0（345 ops/25 groups），[原输出](before-01/source-navigation-220-before-01-docs-after.log)保留。5份FFI（Foreign Function Interface，外部函数接口）生成文件实际出生01:56:30.827–898Z，全部观察闭合后精确workspace界限单文件移入私有忽略目录，[移交记录](before-01/owned-native-pile-archive.json)保留；没有递归清理或移动用户文件。
