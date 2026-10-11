# 280 来源章节定位

[实施前 Recall](../source-fragment-plan-280.md)。单 agent，修改一个生产 owner：`canonicalSourceUrl` 使用原生完整 URL 序列化，不再丢弃 fragment。webfetch、网页搜索和代码搜索沿用同一 Source 生成器；不同章节保持独立来源，同一规范位置继续由现有消息持久化 owner 去重。历史已记录的来源不回写，没有新增字段或迁移。

## 真实页面前后对照

01 正常 dev/ui18223，Main ses_-zUSI84YnzzML3X7MJVT，真实 gpt-6.1-sol 请求一次 MDN `details#examples`。工具标题与模型总结都保留 #examples，SourcePart 与实际点击打开的页面地址却只有 details；Root 查看 [修复前来源](live-01/01-source-before.jpg) 和 [错误顶部落点](live-01/02-target-before.jpg)。根因位于事实生成器强制清空 hash，前端完整消费被错误缩短的 URL。

02 正常 dev/ui18224，真实模型按自然用户输入调用两个 webfetch，两个实际持久化来源分别保留 #examples 与 #technical_summary。[最终来源和完整地址提示](live-02/03-sources-complete.jpg)、[Examples 实际落点](live-02/02-target-examples.jpg)、[Technical summary 实际落点](live-02/04-target-summary.jpg) 均由 Root 人工复核。来源点击打开自己的外部页面5/6，地址与可见章节标题一致；两处来自真实工具与 SourcePart，未把总结中的普通 Markdown 链接当来源验收。两个工具各有自己的来源区域，不伪称同一来源组。标题仍为发布者完整文档标题，不从 fragment 猜章节名。

首次01页面在端口监听前打开失败，自己的错误页1成为 data URL，浏览器策略阻止重新绑定；不绕过策略、不宣称已手动关闭此临时页。该未标记页面依浏览器规则在 turn 结束时自动清理。正常01页面2及外部3、02页面4及外部5/6均已正常关闭。02第一次点击后页签清单尚未更新，下一真实状态确认外部5已打开，没有重复点击或计为产品错误。

## 行为、工具链与生命周期

当前 runner `bun run test test/tool/source-fragment.test.ts test/tool/codesearch-sources.test.ts test/tool/websearch-service.test.ts test/tool/webfetch-source-title.test.ts` 原16196实际 exit0：12正向测试、37断言。真实本地 HTTP 与 SQLite 验证两个章节、重定向最终锚点和同位置规范等价去重；code/websearch 的过期丢锚点期望同步修正。typecheck 原55390实际 exit0。没有 UI 自动化测试，也未以静态检查替代截图。本轮 UI 代码没有变化，沿用当前 main-D6OgLH8i.js。

两轮各 NativeService 固定600000ms/12累计请求，完整授权 auth/models 配对；分别预检凭据usable、目录projected、实际gpt-6.1-sol且streaming=true。01原83006实际0，Native77600(win32:639272846362148669)、Host46420(win32:639272846312731406)，5EOF/0取消；02原59691实际0，Native63032(win32:639272850592890680)、Host65672，6EOF/0取消。唯一正常 shutdown 后，原前台实际 join，再由独立 closure 读回精确出生、物理/输出/请求结束、端口释放和复制配对退休；所有 checker/observer 实际结束后分别保管自己五个 Native 产物，01完成在02启动前。

[actual-source-facts](actual-source-facts.json) 由 [backend checker](helpers/facts.ts) 关联实际工具输入、完成 outcome、持久化 SourcePart 和 Provider reader。01物理03:09:11.846Z，余279408ms；02余506212ms，两轮满足自设提前四分钟目标。最初 piles 命令误传live-01，helper明确找不到该轮路径且未移动文件；改用声明的live01/live02后原检查成功，故障如实保留。实际账本与完整脱敏日志均归档，检查器不做 DOM、截图、摘要或 UI 字符串断言。

本轮只资格当前新生成来源导航。历史已丢失的章节无法从旧来源恢复，原 Research Studio 旧 schema 阻塞与原子侧栏全帧 Rendering 资格仍保留，不能用本轮新 Main 代替。goal 持续 active，单 agent 继续体验和改进 Sources。
