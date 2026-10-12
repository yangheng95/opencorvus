# 343 错误详情复制

[Recall](../error-copy-plan-343.md)。单agent完成错误详情复制交互修复。原生按钮onClick支持单次点击、Enter与Space；删除仅双击路径与局部boolean包装，复用共享copyText。可访问名称为“Copy error details/复制错误详情”，完成后短暂显示绿色check与Copied名称，沿用同一反馈状态和1400ms计时。

## 实际页面

改动前页面128/main-DrobkXyT.js：[01 Enter](01-before-enter.png)只聚焦按钮，[02单击](02-before-click.png)仍提示双击复制。这与原onClick仅stopPropagation、onDblClick才复制的源码一致。

首次after/main-NPcVG69U.js的Enter已经读回完整261字符，但[03截图](03-after-enter.png)显示Tooltip关闭后没有明显成功反馈，因此继续修改同一状态驱动的图标/名称。最终main-DE9lj1nS.js/main-BjT6LMyD.css加载后，[04 Enter](04-final-enter.png)、[05 Space](05-final-space.png)、[06单击](06-final-single-click.png)均显示实际完成勾选；鼠标还显示Copied提示。Root逐张人工查看，没有使用UI自动测试或快照断言。

每种激活前后的真实clipboard数据分别保存在final-enter-clipboard.json、final-space-clipboard.json、final-click-clipboard.json，Root实际读取并核对每次261字符都为原摘要、空行、完整原过载JSON。Space/鼠标操作前写入本轮owned marker，再由应用动作替换。[07真实Ctrl+V](07-pasted-unsent.png)在本轮未发送输入框呈现同一正文，随后清空，没有发送消息。

342原读回差异原因仍未知，原失败观测保持。343查明公共HostTransport facade在browser模式走navigator.clipboard，desktop才走Tauri；本轮核验补齐当前浏览器的复制内容，不把当时的接口名推断当根因。

## 运行与检查

localhost:18320/ui，两个独立Runtime均正式导入真实341的9消息/21 Parts；原始Info、错误及身份保留。无auth/models复制、0新Provider请求。before原启动92775与after原68863均实际join0，Native/Host输出与请求结算完整，分别91487ms/304909ms，600000ms固定上限不变。页面128/129均关闭，两轮各5份native pile按实际出生归档。before/after只涉及自建隔离服务与页面。

overlay typecheck、2语言2135 keys的i18n检查、最终build均通过；最终bundle实际GET200。后端只读事实及物理生命周期见[actual-runtime](checks/actual-runtime.json)，不以它替代视觉结论。纯UI改动未增加后端单元测试。

未验：独立child Dock错误发生场景、Tauri桌面端。105份现有canonical摘要中未找到可用的parent_id+Message.error组合，此有限集合不能证明没有子会话错误。没有重新触发真实上游过载。持续goal保持active，单agent继续。

原始build日志与两个launch脚本副本含实际尾部空白，最终以checks目录下同名.gz无损保存；解压完整字节与原件直接比较相等，私有原件保留。归档只改变承载格式，不修改原失败/成功输出，见checks/raw-compression.json。
