# 287 完整工具复制与可见反馈

[实施前 Recall](../clipboard-feedback-plan-287.md)。本轮全程单 agent，开始 212ad2451 已推送且工作区干净；读取已有 Task，不新建 Task、成员或模型请求。

## 根因与修改

唯一 copyText 已通过 Host 的 clipboard.writeText 写入完整值。旧 copyTextReporting 只把错误交给 AppLog；两个 bare 按钮消费者没有完成状态，也没有本地失败反馈。此前工具标题、来源和操作对象修复未触及这条路径。

新 createClipboardCopy 由当前已挂载控件拥有，ToolPayload 与交付名称共用。Host 实际完成才显示勾选和包含操作对象的“已复制”名称，2 秒后复位；pending 保留键盘焦点，通过同一 handler 抑制重复触发。失败用已有 Feedback 在操作旁呈现原错误与详情，原按钮可显式重试；值变化或卸载退休旧反馈和计时器。旧只记录日志的 wrapper 及两个过期测试同步删除，底层单一 Host writer 保持。

其他已有专用复制状态的消费者未在本轮迁移；不能以这两个消费者代表全部复制矩阵。未改变 clipboard 权限、使用备用写入通道或注入失败。

## 前后真实页面

两轮均为正常 dev/ui 和原 153 已完成 Task 的完整独立副本，已有 base-researcher 的实际 webfetch 结果。完整输入输出从原 Tool 输入/完成结果读取，公开预期值保存在 expected-payloads.json；JSON 字符串保留原换行和空白，没有用摘要或屏幕预览作为复制基准。

前态 18234 / main-ChsCH8Wh.js：[输入复制](before-01/02-copy-input.png)、[输出复制](before-01/03-copy-output.png) 均与真实原值直接相等，分别 112、20733 字符，但按钮无完成反馈。

后态 18235 / main-CdiWzcJd.js：[默认](after-01/01-ready.png)、[键盘 Enter 复制 Input](after-01/02-copy-input.png)、[鼠标复制 Output](after-01/04-copy-output.png)、[随后复位](after-01/05-reset.png) 均由 root 实际查看。两个按钮出现勾选，对应 AX 名称为 Copy Input · Copied / Copy Output · Copied；输入键盘焦点仍在原按钮。输出复核完整 20733 字符，与原值直接相等，包含默认预览外的正文。

每次先把剪贴板原格式集合仅暂存在交互进程内存，未知内容未打印、存盘、粘贴或进入模型。写入后仅在读回仍等于此次已知文本时恢复原集合，恢复 API 正常完成；没有把未知数据放入证据。后态首次 Output 验证脚本因局部变量作用域错误退出（current287a 未定义），03 的 matched=false 表示验证未完成，不能当作复制失败或通过。紧接着基于读回完整相等恢复原集合，再用修正后的同一实际按钮重新验收；04 的 matched/restored 均为 true。没有重启产品或更换复制通道。

本轮没有安全触发真实 Host 写入失败，故失败提示的真实呈现/重试未验收；原 153 没有交付资源行，交付名称消费者亦未获得真实视觉样本。未验证实际屏幕阅读器软件、全部 payload、全部语言和桌面原生剪贴板。静态实现与 Host 契约不能替代这些真实验收。

## 验证与运行保管

正常 UI build 23292 actual exit0（53.19 秒），typecheck 27260 actual exit0，catalog 检查 2 语言 / 2091 键。聚焦 clipboard-single-writer 的两项纯 Host 服务契约通过（2 断言）：精确命令文本、原 Host 错误传播；它们不是 UI 组件测试。未新增或运行 UI 自动化、DOM 断言、浏览器夹具或截图比较。07-panel 公开契约同步。

两阶段 fresh 原 153 精确出生/原 parent30224 join0/端口/凭据对/schema/全部恢复前沿通过，再完整复制 90 表逐行相等。Task completed epoch1、15 assistant 完成、8 permission 与 2 checkpoint 闭合、3 ingress 收敛，两 ProjectMemory idle/pending0；唯一未过期 runtime lease 对应已死亡的精确进程出生，没有重演或修改旧数据。

前态自己的 tab24 关闭、sole shutdown 和原前台 25095 actual exit0，Native62260/出生639272944526940786、Host77316/出生639272944519393405，于 05:55:36.874Z 完成物理输出/请求，剩414987ms。后态 tab25 关闭，sole shutdown 和原前台99759 actual exit0，Native74404/出生639272955332898479、Host75608/出生639272955325449698，于06:12:54.556Z收敛，剩457941ms。两轮固定900000ms，均满足提前五分钟目标；未因观察超时重启或延长。

独立 archive/checker 与13核心表完整行 custody 均实际 exit0；只有全部调用结束后才移动各自5个自产物。最终5Session/22Message/59Part及Provider/Tool事实保持完整，runtime配置173字节直接相等；项目目录属性唯一差异是已审查的.git目录mtime，不把属性记录冒充全文身份。未移交auth；公开模型目录查询按原服务生命周期退休，页面 Model configuration unavailable 是无凭据历史阅读的实际限制，不冒充真实 Provider 验收。

启动前首次准备脚本误替换原272收据路径，读取即失败；恢复该不可变历史引用后重新通过当前资格，没有绕过检查。首次结束读取 owner.json 路径不存在，仅为只读路径错误，随后读取实际 launch-owner.json；未影响服务。

当前范围完成复制成功路径修复及真实工具内容验收。原 ResearchStudio/新实时任务/全帧 Rendering、失败 UI、交付名称和专用复制控件仍有未验范围。当前文档检查、公开证据凭据扫描、范围提交及上游合并/正常推送后继续迭代，goal 保持 active。
