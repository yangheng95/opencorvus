# 219 原始子侧栏工具与Sources

单agent继续原child Dock问题，实施前[Recall与深度](../child-tool-sources-plan-219.md)、[当前安全前沿](../child-tool-readiness-219/README.md)、[新startup manifest](../child-tool-startup-219.json)。原153所有Task/Project/Session/Part身份和原目录保留，完整90表逐行相同副本；没有新的agent委托、任务重跑或模型请求。

## 实际页面与人工视觉复核

当代开发入口 http://localhost:18140/ui/，自有IAB（In-App Browser，应用内浏览器）35，实际 main-Bmeb8tJo 200。原Task/Project/root/researcher/tester身份及原目录完全保留。首次子会话实际显示原正文/三来源；WAI展开显示完整换行标题和www.w3.org，MDN显示developer.mozilla.org。没有原摘要片段，本轮不能推断有摘要数据的布局。

真实展开WAI工具读取Output 20733字符，点Expand后完整输出撑开到18846px，收起工具后回到原Sources/正文；MDN工具读取Output 32395字符。两次真实Part GET都是200，[WAI完整展开](live-01/w3c-full-output-expanded.jpg)、[MDN结果](live-01/mdn-tool-result-open.jpg)均亲自查看。测试员的read_agent_message聚合工具展开5份独立结果，5次canonical Part GET均200，[结构化结果](live-01/tester-tool-read.jpg)可读；显示6个字段是结构化首层折叠，不是157字符完整原始输出，本轮未展开它们的全部字段。

MDN关闭后的研究员阅读基线top103.33333587646484、height2926、follow=false、WAI Source展开。研究员→测试员→研究员、All agents列表返回、Close panel→Open right dock返回，3次事实记录都恢复同一基线、同一2868字符card与Source状态；[切换返回](live-01/researcher-return-from-tester.jpg)、[侧栏重开](live-01/researcher-dock-reopen.jpg)人工查看。[深色三来源](live-01/researcher-dark-three-sources-keyboard.jpg)显示三份完整标题/host，原生Tab到MDN真实链接，可见焦点及tooltip。最后展开另外两来源/Tab带来的top184.6666717529297是当前交互后的新位置，不冒充先前恢复基线。

## 原操作与资格边界

原Main Open入口最初在视口外top-514.0625，原生wheel后真实可见top205.9375；locator click使Main变化但Dock仍未开，保存[原观察](live-01/researcher-open-observation.jpg)。之后根据新截图和当前rect作可见原生pointer点击，Dock实际打开并完成上述路径。此证据只能限定locator交互结果，不能凭工具自述把它定为产品click根因，也不能抹掉原观察。Task初始曾见短暂Rendering；本轮返回截图均已正文完整，没有复现反复Rendering。离散截图不能证明所有帧无闪烁。新child流式、冷缓存、32项淘汰、多项目切换、更广工具矩阵仍未达成；218的新Sol Main/Side Chat资格保持原范围。

## 正常闭合与数据事实

自己35关闭后仅用户23仍在，未重载或操作用户页面。唯一public shutdown，原foreground Host实际join exit0；[生产Native receipt](live-01/child-tool-sources-219-01-native-host-settled.json)01:45:37.899Z exited0、physical/output/request全true，早于固定deadline01:50:33.809Z，未续时或重启。独立OS（Operating System，操作系统）永久出生身份Host77032/Target44324已dead_or_reused、18140无listener、auth/models均absent。[日志窗口](live-01/child-tool-sources-219-01-http-summary.json)339真实当前timestamp行，解析失败0/未知timestamp0，7次完整Part GET真实200。

[最终canonical事实](live-01/final-canonical-custody.json)13个表直接完整行相等：Session5/Message22/Part59，独立Tool request14/progress0/outcome14，Provider request17/outcome17/usage19，Task1/descriptor2/artifact10/version0。两个原Project 44/97项前后属性完全相同（属性观察，不是内容身份）。全程没有新Provider请求/模型调用/Task重跑。本轮生产代码没有修改；补充实际child工具、来源和返回验收。docs检查及提交/推送事实随交付更新。
