# 346 多来源流式复制反馈

[Recall与根因分析](../source-dense-live-plan-346.md)。单agent开发，仅普通Side chat真实模型会话；未委托开发任务或创建产品Task成员。

## 修复

流式正文更新期间，来源的实际复制位置没变，但新的Source元数据对象使createClipboardCopy的on(input.text)依赖失效。Solid的on不比较getter返回值，旧callback因此递增generation并清空复制反馈。两次实际剪贴板都正确，截图03/04却立即恢复普通copy；相同位置在流完成后复制，截图05正确显示Copied/check。

primitive改为先createMemo(input.text)，以实际文本值驱动既有退休effect和异步owner检查。同值对象更新保留pending/success/error反馈；真实值变化和卸载仍按原机制退休。Sources、ToolPayload、交付名称三个消费者共用这一实现和唯一copyText writer；未改Source正文、身份、地址、存储或调度协议。

## 实际体验与边界

独立18323/ui，01页面134、02页面135，官方私有Bun1.4.0。每轮固定600000ms/24次累计Provider预算，授权auth与完整models成对移交；每轮分别验证usable/projected/实际gpt-6.1-sol流式。11张真实截图均已人工查看，没有UI自动测试、DOM断言或截图基线。

- 01初始实际search_code命中24条，来源展开为23 more sources；长中文文件名与真实行号保留。随后read完整25行。正文4403与2088字符。
- 03/04：仍Working时Space和鼠标复制第20行均得到完整路径，成功反馈却消失；05是相同来源流完成后的正常反馈对照。
- 构建后只reload自己的页面，新search_code产生11条新来源，06显示仍Working时Copied/check，实际剪贴板正确；07重开保留来源组和读位。该回复1853字符，已实际完成。
- 02第一条真实请求产生11条来源和1984字符正文；08复制发生在完成后，明确仅为静态验收。
- 为覆盖独立实例中的活跃更新，又发送新的实际search_code请求与约2200字正文要求；09在Working时实际Space复制正确并显示Copied/check，10在关闭后重开期间恰好完成，展开状态和读位仍保持；11人工看到最终正文。该回复2341字符。

01侧聊ses_-zUSAgYMNzz8OY7NNUbs共有36个来源Part，02侧聊ses_-zUSAdcx7zzcZ43IXjZ1共有22个，均按真实Message区分。原始输入、实际工具请求/结果、完整可见正文、各次复制值和Provider reader审计保留。截图不是所有帧证据；本轮没有复现Rendering回退，也没有据此改占位机制或宣称原Research Studio子侧栏问题完全解决。

## 资格与收尾

01的调查/实现/build耗用了原窗口，原handle3385实际exit1，OWNED_QUALIFICATION_BOUNDARY_REACHED；supervisor按原600000ms边界物理结算并清理凭据。其10次实际gpt-6.1-sol请求全部200/EOF，最后回复也在deadline前约6秒完成；这些事实不能把父级资格失败改写成通过。

02为新的独立实例，原handle54052正常shutdown后实际exit0，9次gpt-6.1-sol均200/EOF，qualified-surface-completion为NativeService/physicalCompletion=true。两轮页面均关闭，精确Host/Native、output/request及成对凭据退出均有生产receipt；两组native缓存按各自进程出生归档。没有重启或扩展01，也没有操作用户进程。

overlay typecheck25876与build67101实际exit0；after主资源main-COLMTZiU.js，CSS保持main-Dg1zdEjr.css。纯UI修复不新增UI自动化测试。动态更换复制值、失败反馈及Tauri窗口未另做真实交互，本轮结论限于浏览器流式Source复制反馈与上述读位。

docs:check通过345 ops/25 groups。01/02实际Native寿命599273/317738ms，19次请求均EOF。五次复制值与输入文件完整位置逐一相等；四次活跃复制时间还分别落在对应Side Session的chat Provider真实reader区间内，排除了仅凭Working标签推断流式阶段。81份文本与全部压缩解码内容扫描无凭据。完整监督链原始文本打包为supervision-chain.json.gz，未压缩原件保留私有目录。

工作中出现的Issue40官网文档改动由其原任务提交为99f7c8b9b并进入upstream；本轮保留该交付，不混入自身修改。实际来源展开的第一次Playwright定位未命中，改读当前原生AX控件后点击成功，未改变产品或构造来源来绕过。
