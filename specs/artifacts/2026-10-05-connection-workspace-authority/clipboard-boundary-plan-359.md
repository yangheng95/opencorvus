# 359 来源复制的浏览器边界调查

## Recall

用户要求持续自主改进Sources、UI/UX（User Interface/User Experience，用户界面/体验）和功能，最新人工指令只用单agent。上一goal turn为progress：358以e8a001cee正常到达origin/main，源文件标题与行号分层已真实视觉复核，40图和5个实际gpt-6.1-sol流式请求归档。整体目标仍active；旧goal中的Astra委托措辞不再适用。当前只有其他CI任务月记录未提交，保持原状。

已重读AGENTS、358 Recall和异常记录、07-panel异步动作与Source合同，检查SourceEntry/createClipboardCopy/copyText/host-transport/tauri-transport及Rust真实clipboard命令。全仓检索navigator.clipboard、clipboard.writeText、overlay_clipboard_write_text与调用点；ImagePreview的image/png写入是独立图片操作，未参与本次文本复制。触及的clipboard-single-writer和clipboard-api-key-prompt是纯服务正向契约测试，workspace-source-resolution是构建解析测试，均非UI自动化；本轮不运行这些测试来证明真实剪贴板。

## 现象、根因边界与方案

358 final-main及clipboard历史页曾显示Copied，工具readText及Control+V仍得到前一个live页10–12范围；后续原生草稿Control+C正常，应用复制乙2/3也能正确读回。首次立即读回不能被定性为异步时序；后续成功不能抹去失败。生产单writer把Source.path/range原值交给navigator.clipboard.writeText，await fulfilled后当前generation才显示Copied，Tauri直接写系统剪贴板。未发现双writer或错误字符串生成的代码证据，精确根因未知。

本轮先不修改生产实现。独立credentialless全历史scope clipboard-boundary-359/18354，源仍为完整闭合356-live-02；重新检查schema/config/recovery/permissions/Message/Memory和精确进程身份，完整90表copy保留Project/Session身份。固定NativeService 600000ms；历史不重新发模型请求、不派遣成员、不重启用户页面。沿用358正式构建main-CrFGPI-s.js，当前相关源码与该构建一致，实际HTTP和截图分别确认。

在真实页面用明确的自有非敏感marker建立浏览器剪贴板对照，点击可见Source复制后，先尝试原生Shift+Insert到自建未发送草稿，再与Control+V和工具read/readText对照；每次新的目标行号可区分上一值。草稿立即清空，不发送。所有截图人工查看，剪贴板值仅人工观察，不写DOM/组件/文案/截图/剪贴板UI断言或fixture。必要时改用已有正文/文件复制入口作同writer对照，不添加fallback或读回权限。工具不支持的原生动作明确记录，不用浏览器隐藏状态、绕过工具或另一个自动化框架弥补。

如果差异仍未分离，保留原失败并推进可验证的下一项调查，不将未知原因猜成产品bug。若发现可定位产品根因，先补充本方案的数据流/公共契约/风险与相关全仓搜索再实施，真实页面回归后提交。没有调度、队列、并发或恢复修改；出现该类异常则立即按全生产Task/Mission/Session横审，不能归为局部。

## 验收与交付

### 实际顺序对照及追加独立页面

本轮已取得有区别的事实：先写自有marker的页167，来源2的Shift+Insert及来源3的Control+V/立即读取正确；未预先调用剪贴板API的页169首次可见原生复制来源2显示Copied，却读回旧10且粘贴旧10，再次同目标复制读回2。页170先复制4再Shift+Insert（读取接口尚未调用）仍粘贴旧2，因此不能只归因readText。页171正文复制也首次旧2、再次正确正文，范围已扩展到共享浏览器写入，非Source标签专属。页168初次locator点击时目标不在视口且无反馈，不算成功复制或复现；其可见指针复制10/实际粘贴正确。

全部5张自建页已关闭，原启动76574已实际exit0，公共shutdown完整收尾。没有调度或运行异常。下一步在相同浏览器打开官方MDN Clipboard.writeText说明的现有复制按钮，使用真实网站交互作跨应用对照；不创建测试页面或browser fixture，不向该网站提交数据，不调用其页面隐藏函数。若独立网站也出现同样首复制行为，可据此缩小OpenCorvus专属根因的可能性，但仍需区分观察工具与浏览器宿主；不据此谎称已修复。所有截图/读回仅人工观察。

MDN页172真实首次Copy显示Copied但读回此前OpenCorvus正文，第二次同按钮读回writeText(newClipText)，text/plain一致，已关闭页面。独立站点复现相同首复制现象，Source-specific归因不成立；精确浏览器/工具机制仍未知。生产实现保持原样，不加primer、双写、重试或权限。实际11 Message/192 Source、90表copy、HTTP资产及Native447294ms exit0检查通过。所有失败和17张人工截图保留；最初copy证据目录冲突在启动前拒绝，修正为新history目录后完成，原失败日志保留。范围提交仅调查文档和证据，整体goal继续active。

真实原始Source、按钮反馈、粘贴草稿和工具剪贴板值逐项记录，不能只看Copied。源历史值完整核对，HTTP服务、Native/Host实际终态、端口/输出/request闭合，关闭自建页后调用公共shutdown并join原handle至exit。无凭据，无Provider资格宣称。截图和日志保留所有失败，归档扫描敏感值。更新根/目录/月索引、docs:check、范围提交、fresh fetch/merge、完整待推送集合审查及正常push。仅调查时也明确是否有产品修改和仍未满足项，不将持续目标标为完成。
