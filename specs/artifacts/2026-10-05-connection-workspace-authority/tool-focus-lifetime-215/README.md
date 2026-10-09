# 215 保留真实焦点子树的数组协调

## Recall 与完整根因

用户持续Sources/Rendering/UI（User Interface，用户界面）及功能体验，最新单agent。[修改前方案](../tool-focus-lifetime-plan-215.md)记载649bdcee基线、原214的Tool Tab失焦及全部已读定义/调用/资料/风险。原21501当前main-BOwxTyIC仍复现Source A→CtrlEnd→Tab落BODY；诊断不是修复，原失败保留。

49.44s诊断构建main-D1t5T-Ck的[实际节点事件](live-01/native-node-lifetime-events.json)证明Tool button仍connected、全部祖先visible，来源item及其ExecutionEventRun没有cleanup，排除简单替换/隐藏/卸载猜测。追加48.81s诊断main-D04kSc7S的[真实调用栈](live-01/native-focus-origin-stack.json)指向已载native-menu-surface-contract-b_vimv-0.js:1:19769/wn；真实编译片段与安装solid-js1.9.14共同定位reconcileArrays的replaceChild分支。旧[Source,tail]→新[user,Source]有同一来源子树，性能启发式却先移除再插回，原生focus因此丢失；组件不cleanup、最终DOM（Document Object Model，文档对象模型）可见/connected并不能证明没有该过程。Source pin只保持组件，不保护此DOM重排。

## 当前唯一修复与作用域

仓库已有patchedDependencies绑定[标准solid-js1.9.14 patch](../../../../patches/solid-js@1.9.14.patch)，root package.json/bun.lock同一配置面。此映射前缀协调分支若旧子树contains其ownerDocument.activeElement，就选择既有insert-before路径插入前方节点，保留焦点子树；其他性能条件保持。不匹配Source/Tool字符串、特定索引或测试会话，不调用focus、不增加计时器、全局键代理、DOM prototype劫持或第二渲染器。

四个web开发/生产ESM（ECMAScript Module，模块）/CommonJS出口同步，不升版本、改服务端或声明。[官方协调源码](https://github.com/ryansolid/dom-expressions/blob/main/packages/dom-expressions/src/reconcile.js)与[MDN移动状态说明](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)用于决策：组件身份与原生交互状态不同；后者API（Application Programming Interface，应用程序编程接口）有限平台支持，未引入其浏览器要求或feature fallback。当前虚拟窗口保留交集的canonical顺序，交叉真实重排分支不属于本次修复/视觉资格；一般其他组件重新排序、其他Solid版本及平台明确未覆盖。

本机bun patch prepare成功，commit两次EPERM/copyfile，原工具退出1保留在[工具链说明](live-01/toolchain-patch-authority.json)。基于成熟Git真实no-index原包/已准备包差异生成标准patch文件，正常bun install真实应用，frozen install/package topology/types原59705=0。没有忽略完整性、hook或凭据保护。patch不会依赖私有node_modules修改才能生效。临时CardParts/Conversation诊断全部删除，两文件最终同基线。

## 真实页面结果

最终build原14785=0/51.43s，公共renderer surface1/1；真实最终asset main-BvdfiTpl，两scope原HTTP200记录保留。UI仅实际CUA（Computer Use Automation，计算机界面操作）输入、截图和负责者人工查看，无UI自动化测试。

21501 [修复后的Tool Tab](live-01/fixed-tool-tab-a.jpg)/[6s稳定](live-01/fixed-tool-tab-b.json)为真实MDN Tool BUTTON/owner/chatScroll/top448.666/followfalse；旧BODY失败保留。实际Space请求Tool正文却400 ProviderModelNotFoundError/gpt-6.1-sol，request2f2c1ca0-2341-4259-b8f9-13b817a4a8d2；[原失败截图](live-01/fixed-native-tool-expanded.jpg)显示整个card错误取代正文，Sources消失。该scope没有catalog/credential移交，不误报用户auth缺失，不能冒充Tool展开通过；局部错误展示与完整配对的功能资格后续查。

21502 fresh完整原213副本：[真实来源A](live-02/source-a.jpg)→End9092/true→Home0/false→End→[Tool Tab](live-02/tool-tab-a.jpg)/[稳定](live-02/tool-tab-b.json)同BUTTON焦点，继续Tab到[下一Source summary](live-02/next-source-heading-tab.jpg)保持焦点/448.666/false。没有locator重新聚焦来掩盖连续路径；draft native caret0→42，外层不变，草稿清空。第一observer捕获旧闭合page30的原工具错误保留，未产生图像；随后新page31绑定观察才是本scope证据，不能把工具错误记作产品问题。

## 原失败、新正常闭合与数据

21501原父56246=1，Native23:53:34.060Z deadline_exceeded/1，物理/output/request清理及独立OS（Operating System，操作系统）birth/18135/pair完成，但整体原生资格失败。public shutdown开始过晚，之前将清理完成称正常退出已纠正；旧期限/终态未改，旧scope不重启。固定预算按现有监督器执行，不以此猜测新的调度修复。

21502独立父97779=0，Native2026-10-09T00:03:51.872Z exited0/physical/output/request，远早于固定deadline1791505008685；独立Host70244/Target68340精确出生身份dead_or_reused、18136/pair关闭。自己page30/31关闭，用户page23未操作。原两个项目/Session/Message/Part IDs保持；每副本全部90表完整行初始相等，最终两个scope的Session/Message/Part及Provider请求、结果、usage六表实际完整行均同原213，证明没有新模型记录或历史改写。

5个本轮FFI（Foreign Function Interface，外部函数接口）文件在21501生成、21502复用，两个scope真正闭合后按精确出生时间/绝对workspace界限单文件移入私有忽略目录，[custody](generated-native-observer-custody.json)保留。公共构建日志仅去掉行尾空白/额外EOF空行，私有原件保持，Native/事件/数据库/HTTP事实未做该处理。

## 未满足范围

Tool正文读取/错误局部展示、完整配对Side Chat、新代码真实流式、child及其他平台/交叉重排尚未资格化。原21501期限失败、400、原214/212失败永远保留，新21502成功不覆盖它们。持续单agent目标保持active，不宣称全部问题修完。
