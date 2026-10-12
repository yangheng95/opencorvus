# 361 侧栏长正文与来源

[Recall与方案](../side-stream-plan-361.md) · [运行汇总](checks/runtime-qualification.json)。本轮单agent完成当前SDK 7下的真实长输出观察，并修复中文表格在窄侧栏被压成逐字竖排的问题。长期迭代目标继续active。

## 缺陷与修复

同一真实Side Chat消息msg_g0VXrs5pl00f3VLP3mOB含11行四列表格。380px侧栏内原表宽348px，首/尾列44.3875/55.7625px，高1493.25px，clientWidth与scrollWidth均346；中文普通换行允许逐字压缩，导致已有本地水平滚动没有触发。[修复前截图](06-cramped-table.png)和[实际几何](table-before.json)可复核。

共享markdown.css现有表头使用word-break:keep-all，让中文词组提供固有列宽；正文维持normal，现有focusable原生table继续负责水平滚动。没有新增固定列宽、wrapper、事件、来源分支或渲染状态。修复后同表首/尾列72.8/132.8px，表头高32.95px，表高591.5625px，client346/scroll424；[表头截图](11-table-readable-header.png)、[方向键到最后一列](13-table-keyboard-last-column.png)、[几何](table-after.json)。281px窄侧栏仍保持这些列宽并局部滚动；600px宽侧栏四列完整同屏，表高569.725px。[窄栏](16-table-narrow.png)、[宽栏](15-table-wide.png)。

## 真实链路与人工操作

原live/18358先独立确认OpenAI凭据usable、完整models目录projected、实际请求gpt-6.1-sol/streaming，再由真实Main及Side输入执行。当前8次请求全部HTTP200并到Provider source reader EOF，预算12未耗尽。canonical共有3个Session、9条Message、16个Source；真实search_code输入path=资料/流式来源、pattern=STREAM361、include=*.md。最终Markdown5223字符，含3646汉字、九节加主标题、10个表格正文行及实际代码块；工具证据和模型正文均自然产生，没有修改历史内容。

人工观察正文1470→2927→5023个DOM文字字符；向上阅读后scrollTop3992，输出完成及重开后相同段落仍在top435.2875。截图02–05记录了实际增长和阅读恢复，没有在这些采样帧看到Rendering占位。初版helper的visibleBlocks会纳入折叠Reference history后代几何，不能据其声称这些内容已绘制；真实截图为视觉依据。

after/18359是原scope关闭后，以当前schema/config/recovery/Memory复核并直接比对90表全部行内容的credentialless完整历史副本。页面实际加载main-1Vm28pXW.js，原live为main-LvnQ77kF.js。模型配置不可用提示是该只读验收副本没有凭据/模型目录的真实状态。表格可见焦点下两次Right键使scrollLeft到77.6而纵向读点保留。还实际展开16条Sources、打开最后一条甲目录第9行并看到高亮、回到Side原列表，再以Enter收起并看到焦点回到Show 15 more sources。[展开](17-sources-narrow-expanded.png)、[目标行](19-source-line-nine-loaded.png)、[返回](20-sources-return.png)、[键盘收起](21-sources-collapsed.png)。截图18保留原始Loading中间帧，19才是打开完成证据。

## 边界、检查与收尾

离散截图不能证明所有流式帧从不闪烁，也不能代替原Research Studio成员侧栏的全部验收。Sources展开操作发生在输出完成后；Main长表、其他Markdown消费者、更多主题/比例及超长中文表头没有在本轮逐项复核。359跨网站首次复制异常仍未定位，未增加复制绕行。

纯CSS修复没有增加或运行UI自动化测试。overlay build（原handle92431 exit0）、typecheck（98113 exit0）、CSS token检查均通过；docs与architecture-index结果保存在checks。构建现有第三方use-client/chunk警告未阻塞产物。两次NativeService固定600000ms，live462383ms、after195109ms关闭；原handle49515/33553均实际exit0。真实Host/Native、输出/request、端口与auth/models成对清理有独立回执，没有重开或延时。

调查辅助脚本首次遗漏readiness目录，随后引用了错误的manifest文件名；原错误均发生于历史服务启动前，已修复并重跑实际guard/全源读取/复制链，保留原失败事实。证据按原文脱敏并压缩，解压字节直接等同原文是归档完整性检查，不作功能验收。所有截图均由root实际查看；工具清单、模型自述和静态检查不替代它们。
