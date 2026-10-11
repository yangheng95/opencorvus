# 297 可见会话控件点击

[Recall、诊断设计与根因](../activation-plan-297.md)

最终改动仅在 Conversation 的 VirtualWindowShell：用单一 createMemo 产生完整动态样式，pointer-events 继承所在界面的交互策略。滚动期间保留可见控件的原生点击，弹窗对背景的限制继续生效。没有改库、按钮事件、挂载范围、测量、后台请求或模型数据。原 Sources/子侧栏实时 Rendering 问题仍需继续调查。

## 最终验收：history-04

最终types83513与build38693 actual0，构建50.96s；构建实际完成后才启动18257。tab50真实加载main-DBFH-HgM.js，临时诊断全部移除，原CSS行auto方案已删除。

- [相同初始位置](history-04/01-target.png) → [原失效定位点击成功](history-04/02-pointer-open.png)：正确打开已有base-researcher。
- [命令弹窗](history-04/03-command-dialog.png)：真实焦点位于搜索输入；body、虚拟窗和背景Open按钮的计算命中策略均为none，见03-modal-policy.json。[外部点击](history-04/04-dialog-dismissed.png)执行原关闭弹窗行为，背景侧栏保持关闭。
- [键盘Enter](history-04/05-keyboard-open.png)打开同一成员；[工具展开](history-04/06-tool-open.png)显示真实Input/Output。
- [来源点击](history-04/07-source-link.png)真正打开了[W3C原网页](history-04/08-source-page.png)。由此打开的51页及主50页均已关闭。

所有UI（用户界面）操作与截图由root人工复核，没有UI自动化测试、断言、夹具或合成事件。只读DOM（文档对象模型）样式/几何只补充截图，静态编译片段不是视觉验收。单agent、既有真实Task153完整历史，无新Task、成员、Provider（模型服务商）请求或凭据移交。

## 根因证据与未采用实现

history-01的[定位点击](history-01/02-locator-click.png)未打开侧栏；[实际事件](history-01/02-locator-events-read.json)证明坐标(1136,269)在Open矩形内，节点身份2始终connected，pointerdown至click却全部落到chat-scroll背景，按钮与虚拟窗为pointer-events:none。[滚动结束后同坐标](history-01/03-coordinate-click.png)成功；03-coordinate-events保留同一节点、同一scrollTop=531.333及完整事件到达按钮。

定位动作在派发前引发了滚动，不能据此称静止普通鼠标点击也失败。安装的Virtua0.49.3 Solid发行代码在滚动期设置窗口命中抑制，影响已显示交互内容。显式继承保留外层限制，属性语义参见[MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events#description)。滚动期间可见内容继续参与命中/hover，性能全域未量化。

- 第一阶段直接给行auto，01的04–09图通过定位/键盘/来源/工具操作；随后横向复核发现其继承范围过宽，可能盖过弹窗上层策略，已删除，不能当最终交付。
- 第二阶段启动被错误地与build并行，服务先冻结了missing UI来源，/ui/实际404。浏览器显示ERR_BLOCKED_BY_CLIENT，但服务日志确认缺失界面；健康API成功不等于UI可用。history-02没有通过视觉验收。原实例正常关闭，未续期。
- 第三阶段正常加载，但直接JSX spread加静态inherit被编译为静态模板与动态spread两次写入，实际属性被库更新覆盖，[03失败截图](history-03/02-final-pointer-opens.png)保留。最终移入单一computed对象后才在04通过。其旧bundle已被随后构建替换，编译片段记录来自本轮实际读取工具输出，不伪称旧文件仍可读取。

第一次ReadLines读取活跃日志遇到共享模式错误，空[]保留为02-log-share-read-failed.json，随后Get-Content取得真实事件。资源前置检查第一次错误假定/assets绝对路径，当前Vite base为./，已据实际引用修正；该错误未启动新实例。

## 运行保管

四个实例各自fresh只读资格、完整90表复制和固定900000ms。原前台95962/16577/66849/95621均actual0，独立物理/输出/请求/端口/配对关闭通过；UI失败与进程正常关闭分别记录。每个final-canonical-custody保留19表及47执行生命周期完整值相等、运行配置直接字节相等、两个原项目文件属性比较。文件属性不是全文身份。原关闭时间及余量见checks.json；各自五个自产物在相关checker完成后按精确出生和限定路径归档。全部当前页面关闭，无后台遗留验收实例。
