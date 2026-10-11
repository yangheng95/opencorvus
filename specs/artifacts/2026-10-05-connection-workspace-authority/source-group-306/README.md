# 306 多来源直接链接与余项层级

[实施前 Recall、根因与范围](../source-group-plan-306.md)。单 agent，普通 Work Chat 独立检索，没有成员委托；三轮均使用完整 auth/models 配对和实际 gpt-6.1-sol 流式请求。

## 改动和实际体验

原多来源 summary 使用第一篇标题，点击只展开，展开后标题重复；折叠时站点身份不可见。[原版](live-01/01-before-collapsed.png)、[原展开](live-01/02-before-expanded.png)与当前代码共同确定这一呈现根因。

现在第一条始终使用真实 SourceEntry，显示标题、站点和原文入口；“其余 N 条来源”独立展开剩余条目，来源顺序/身份/编号和完整摘要不变。删除旧标题预览与数量徽章的专用样式，复用原生 Disclosure 和唯一会话展示状态。主会话、侧聊和子侧栏共用该组件。第一条不会因组数量从一变多而换成组按钮，但本轮没有捕获自然增长瞬间，不能声称原 Rendering 闪烁已经因此根治。

第二轮发现余项summary被flex默认stretch拉成整行：[中间未完成画面](live-02/03-after-list.png)。局部align-self修正后重新构建和启动第三个独立服务：[最终收起](live-03/01-final-collapsed.png)、[最终键盘展开](live-03/02-final-expanded.png)、[最终中文列表](live-03/07-final-chinese-list.png)均亲自查看，按钮保持紧凑，首条与余项各按真实来源显示。

真实首链接点击打开[MDN目标页面](live-02/04-direct-source-target.png)。第三轮原生Tab进入已呈现的第一条原文，End实际到末段；[末段](live-03/04-first-excerpt-tail.png)与[重开](live-03/05-excerpt-reopened.png)人工复核，内滚动位置796保持，client287/scrollHeight1083。[只读几何记录](live-03/excerpt-reading.json)仅辅助截图，不是UI自动化测试。五条结果每次来自真实Exa响应，未注入数据或改写结果。三轮是独立真实检索，不是同一数据库回放。

## 检查与边界

Overlay typecheck、两语言2123键、CSS token检查、最终正常build和renderer surface检查通过；最终main-cvYkVasB.js、/ui及对应实际asset均HTTP200。首次手工asset探针丢掉/ui基路径而失败，原served-asset.json保留；served-asset-corrected.json按HTML真实相对引用解析后成功。此探针不作为视觉验收。

一次过快的连续键序列在摘要展开后落到下一条链接，live-03/03-excerpt-tail-keyboard.png实际是该焦点位置，不能作为原文末段通过证据；后续先观察原文已呈现，再自然Tab进入阅读区、End、收起重开才得到上述完整证据。根因时序未进一步取证，不把它归为已修产品缺陷。最初按AX按钮角色定位summary、展开后未区分同名region的定位尝试也未匹配，随后按实际summary节点继续；没有生产旁路或force点击。

本轮没有新增/修改/运行UI自动化测试，无后端行为修改。纯UI静态检查不代替实际页面和截图。**未验**：本次更改后的真实子侧栏、流式单→多瞬间、恰好两条/单条/file/document矩阵、浅色主题与Tauri原生窗口；原用户Research Studio全帧闪烁仍未宣称全部解决。

## 原生进程、凭据与交付

live-01/02/03分别端口18269/18270/18271，Native66936/21420/23056，Host74548/64868/70296。每轮5次实际gpt-6.1-sol stream/HTTP200/EOF，共15次；普通会话无parent成员。所有自建页面67/68/69/70已关闭，三个原前台53347/57015/91672均实际exit0，独立精确出生、物理/输出/请求、端口和配对凭据清理均通过各closure-readback。每轮全部检查器结束后才保管自己的5个Native生成文件，下一服务在其后启动。

[汇总](evidence-summary.json)保留真实Session/Project/Source身份和摘要长度，canonical-current-conversations.json为各轮关闭后只读完整查询；日志脱敏后无损gzip并核对展开字节，私有原文仍保留。155份公开文本初扫凭据命中0。所有检查与复核范围见本记录；持续goal仍active，仅单agent推进。
