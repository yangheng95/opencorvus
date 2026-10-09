# 227 共用菜单的真实宿主呈现

[实施前Recall](../menu-surface-plan-227.md) / [初次完整准入](../menu-surface-readiness-227/README.md) / [修正后完整准入](../menu-surface-readiness-227-after02/README.md)。单agent持续迭代225实际branch transformCallback错误，统一三个真实调用者的当前实现。

## 当前实现

原native-menu.tsx列表/toolbar/keyboard与卡片CSS提取为唯一CommandMenuSurface与共享样式。统一open/close服务改为command-menu-surface，原服务删除、无兼容alias。现有HostTransport.kind在呈现前选择互斥的Web或Tauri物理宿主；Web不调用Tauri事件桥，Native原window/event/measure/label/capability合同保持。

Web用现有Popover做定位/碰撞和关闭，用已有HTML manual popover primitive保留anchor父DOM中的焦点归属并进入浏览器top layer，避开祖先overflow裁剪。它只让菜单接收pointer，单一active request/owner和closePromise覆盖两种宿主。closePromise在physical close开始前发布，结束呈现后才分发原真实动作；没有第二菜单模型、缓存或失败后切host路径。

## 实际页面和修正

首版types/CSS/build通过，actual asset main-DO5o77Mh.js200；[首次branch截图](after-01/branch-open-english.jpg)实际菜单/Env因外部focus一起关闭，原失败未覆盖。父Popover真实onFocusOutside/dismiss/unmount链确认body Portal焦点归属错误。修正后的容器归属和原生top layer在新after02/current main-DwpnxWnx.js200复核，原after01完整关闭后才启动新occurrence，不延长原截止或复活旧服务。

- [英文branch](after-02/branch-open-english.jpg)：实际main checked、默认首项focus、viewport碰撞后菜单在Env左侧完整显示。
- [深色中文branch](after-02/branch-open-dark-chinese.jpg)：真实中文/深色保存后相同当前分支和主题、密度、勾选。
- [英文Local](after-02/local-open-english.jpg) / [深色中文Local](after-02/local-open-dark-chinese.jpg)：真实原目录和当前host动作；branch→Local切换仅当前菜单显示。
- [Browser工具菜单](after-02/browser-tools-menu-dark-chinese.jpg)：同一renderer的toolbar/checked项真实显示；Web宿主原Native能力为disabled，没有伪造可用状态。全部禁用时实际focus shell，Escape关闭并回到原“更多浏览器操作”按钮。
- [原Source文件](after-02/sources-file-opened-dark.jpg) / [最终返回阅读](after-02/sources-return-dark.jpg)：原来源/正文可打开并返回，未编辑文件或发送模型消息。

上述截图均实际显示并人工查看。Escape后原Branch按钮获得focus，Enter重开/操作当前main完成关闭，反复开关/切菜单、父Env关闭均保留原人工观察。DOM（Document Object Model，文档对象模型）文本只是定位和事实辅助，没有新增或运行UI自动化测试。

## 未达成与新线索

真正Tauri Native菜单窗口的视觉/交互本轮未获得工具证据，不能用Web截图或后端Native进程闭合冒充该验收。共享Native传输和renderer完成编译，但Native窗口呈现仍待后续。

[复制路径提示](after-02/copy-path-dialog.jpg)显示实际原目录成功文案，但工具clipboard读取和实际Control+V得到非原路径文本；[人工观察](after-02/copy-paste-manual-observation.json)记录未匹配。Browser实现确实await navigator.clipboard.writeText；工具与浏览器origin/操作系统剪贴板的关联尚未核实，复制端到端不能宣称通过。样本文本作为外部数据处理，没有当用户指令执行，也未进入公开spec或提交。隔离草稿立即清空且没有模型提交。

Web Browser工具当前Native能力不可用而正文空白，后续继续调查可用性反馈。原computer MCP500、多managed/长菜单视觉矩阵与其他Sources种类仍待迭代。

## 检查、原历史和实际终态

[原检查输出](checks/README.md)：types/build/CSS三轮实际0，最后types03/build03/css03为当前代码；docs当前检查通过。构建是Node.js Vite，正常项目开发serve /ui验收。没有UI test、fixture、快照、文案或像素断言。

两份完整原自然Source历史各90表逐行相等复制，保留原Project/directory/Session。没有auth/models复制、新模型请求或历史Task/子agent重启。自身IAB49/50关闭，原exec98857/73575均实际退出0；两个后端Native host均actual exited0/fullphysical-output-request，固定900000ms截止内闭合，原receipt与独立birth/端口/资料检查分别保留。这些是CLI原生运行器事实，与Tauri GUI窗口验收分开。

两份[after01](after-01/final-canonical-custody.json)/[after02](after-02/final-canonical-custody.json)最终13表完整行均相等，两个原Project无增删条目，主Project只有.git目录mtime变化，原文件正文保持。每个occurrence的精确5个Native出生文件在其全部观察/检查终态后逐文件移到独立私有归档，原事实保留，没有递归清理或终止用户进程。用户IAB23未操作。

范围commit、正常fetch/merge上游与push后，持续goal保持active，单agent继续后续问题。
