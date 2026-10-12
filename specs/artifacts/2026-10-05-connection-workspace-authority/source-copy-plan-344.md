# 344 子侧栏 Sources 阅读与来源位置复制

## Recall

用户持续要求自主体验、修复、改进UI与功能，最新要求只用单agent。343为实际progress，3588a685a1558e740f939ff78161076483e0f446已推送，开始工作区干净。用户首要问题仍是Sources显示与子Dock反复Rendering。本轮回到真实子会话，沿用已完成328/329的真实数据而不创建开发子agent或新模型成员。343复制内容已由真实Enter/Space/单击和Ctrl+V验证，不重复当作待修bug。

## 已读、现象与影响分析

已读343 Recall、328/329实际子会话证据、307/312 Side Chat边界、320文件来源密度、277原Research Studio历史schema限制；搜索并阅读SourceParts/SourceChip/SourceEntry、CardParts引用分组、SubagentConversationPanel、来源CSS、createClipboardCopy与两个现有调用。328/329证明近期真实子会话有限观察帧中的来源展开、返回、后续生成稳定；不能推出所有长会话或原209来源记录均无闪烁。原277 Task数据schema不满足当前启动合同，不做迁移、删除索引或伪造父子关系。

当前SourceChip为网页anchor、文件button，完整来源位置只在Tooltip中显示。来源区没有独立复制操作，文件按钮也没有网页链接的浏览器复制地址语义；科研资料摘录时获取精确路径/行号需要额外打开文件。先在实际子侧栏核对这个操作现状，再提供紧凑来源位置复制。不是再次改写Sources分组或推测renderer根因。

当前clipboard-copy primitive已覆盖值变化/卸载退休、pending、成功与错误反馈；应直接复用，不能再加平行复制状态或写入通道。所有SourceParts调用共用SourceEntry；影响Main/child/Side Chat的来源行。只复制真实source-url.url或source-file.path与其既有range格式，网页保留原编码/片段，文件保留完整路径和行号；无可定位地址的document不制造地址。主打开动作、消息/Source身份、真实流和后台调度不变。没有新的调度/恢复异常；若发现则按共享机制审计。

## 实施方案

在原SourceEntry增加独立同级复制按钮，避免button嵌入anchor。复用Button、Icon、createClipboardCopy、Feedback；名称中明确来源位置，支持鼠标与原生键盘激活。行动区域不改变正文顺序和来源展开语义；在窄Dock中保持主标题/位置两行可读，使用现有尺寸/颜色token，实际截图决定是否需调整密度。只在观察和影响分析完成后修改生产代码。

## 真实验收与交付

目标为329的真实Task tsk_g00VXnHXUY002nUsxVFT、项目prj_hnAe7JXn1mGYEFjYlQiU。先检查原Host/Native已死、Task完成、auth/models退休；完整只读current schema、Task/dispatch、Message、权限、publication/lease/ingress、Memory/配置与文件范围资格。通过后复制完整runtime，逐表完整行对照，不改Source或消息。新独立18321/ui，固定600000ms，0新Provider调用；原始project与凭据不变。使用既有history-ui-copy/native-launch流程，新的manifest与证据明确绑定本轮。若资格不满足，记录具体事实并继续排查，不标记副本合格。

先人工查看真实子侧栏文件2/3/4行来源、网页片段和长URL，评估密度与复制现状。改动后正式build与overlay typecheck/i18n/docs检查；新独立实例人工核对来源显示、展开返回、鼠标和Enter复制，以及真实剪贴板/未发送Ctrl+V。禁止UI自动化测试、DOM文案断言和截图基线；本轮不新增假Source或假消息。完整截图必须人工查看，数据检查不代替视觉。主目标child要实测，其他共享使用面不冒充已验。

保存失败与成功证据，关闭本轮页面及自有服务，原启动句柄实际join；按出生保管本轮native pile。spec根/月/目录索引同步，精确commit、fresh fetch/merge、检查完整待推送集合并正常push。持续goal保持active。

## 最终资格

真实子侧栏before/after页面130/131，文件位置:2/:4、原打开第4行、MDN片段Space复制、长查询单击复制、关闭重开读位和未发送Ctrl+V均人工查看。9张截图、四次实际clipboard值保留。源14消息/6来源/15持久Provider身份与两轮实例完整一致，0新请求，不把它替换为原329实际Provider审计17的总数。13632/14069实际join0，228726/299283ms、两组物理输出/请求闭合，页面关闭，native pile按出生归档。types/i18n/build通过，main-tuh6dcX2.js实际200。无UI自动测试；原复杂历史/新实时生成/Tauri与更多来源类型仍未验。详细证据在source-copy-344/README.md。
