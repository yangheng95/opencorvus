# 309 来源标题与站点信息层级修复

[实施前Recall、根因和范围](../source-hierarchy-plan-309.md)。仅单agent，两次独立正常开发服务；所有来源来自实际工具，不创建Task成员或UI fixture。

## 问题与唯一修复

[原无标题来源](live-01/01-before-sources.png)显示“/robots.txt · www.w3.org”，下一行又是“www.w3.org”，链接无障碍名也重复站点；[原根网址](live-01/02-before-root-url.png)是“/ · api.github.com”加重复次行。根因是既有label仍拼接hostname，而208加入的location次行又显示host；306只改分组入口，没有改这条身份拼接。

同时标题和站点都有下划线：CSS把underline放在整条chip，detail的none无法撤销祖先装饰。[MDN权威说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-decoration)与实际样式/截图一致。当前唯一SourceParts改为：无标题非根URL主行只展示path/query，次行继续host/fragment；无查询根URL直接用host作主行。如果主行已等同host，次行仅呈现实际fragment，空则省去；无障碍名组合实际非空的主/次行。真实标题优先，完整URL和来源存储未改变。

messages.css把下划线、颜色和偏移移到label，hover只强化该label，站点/index/icon保留各自层级；删除detail上的无效撤销规则。完整点击热区和focus框继续属于原chip，没有新的renderer/数据缓存/接口或配置。Main、Side和真实子面板共用该实现。

## 真实 after

[三来源新显示](live-02/01-after-sources.png)：/robots.txt与www.w3.org各出现一次，MDN原标题保留，两个站点次行清楚且不带标题下划线，README来源仍有明确动作提示。[根网址](live-02/06-after-root-url.png)只显示api.github.com，实际无障碍名是Open web source: api.github.com。

[键盘来源提示](live-02/04-keyboard-source-tooltip.png)：从前一真实webfetch控件Tab到来源链接，焦点框可见，完整https://www.w3.org/robots.txt保留；Return实际打开[原始网页](live-02/05-real-web-target.png)。[根网址键盘提示](live-02/07-root-keyboard-tooltip.png)同样保留完整https://api.github.com/。

点击结构化文件来源后02-source-file-open.png是加载中的中间画面；[03实际文件全文](live-02/03-source-file-loaded.png)确认编辑器加载当前隔离项目已有README的真实一行内容，未编辑或保存。该图也呈现MDN来源hover时标题强调与完整Tooltip。最后[返回三来源](live-02/08-final-sources-return.png)仍保持新显示。外部页的浏览器表面尺寸与最初页面不同，截图按实际桌面保存，不作像素基线比较。

两轮各实际读取W3C text/plain、MDN text/html、已有README和GitHub根application/json，共四个Source；根网址另起普通Chat以避免重复发送庞大MDN上下文。canonical-current-conversations.json保存原始title/url/path等，缺失网页标题仍真实缺失，没有补造metadata。before/after是独立真实会话和项目，文件绝对路径自然不同。

## 检查、边界与闭合

Overlay typecheck、CSS token检查、两语言2123键检查、正常build与renderer public surface均通过，最终main-D3RC9wbA.js和/ui实际HTTP200。当前docs/architecture检查随最终记录执行。此次只改UI，不新增/修改/运行UI自动化测试，不跑无关后端测试；实际交互和截图人工复核是视觉依据。

本轮未新增doc source自然数据，未单独验非常用端口/根fragment、浅色主题、新子面板流式及Tauri原生窗口；不把当前修饰修正称为原Rendering全程问题已解决。此前307/308的流式/子会话证据保留其原范围，goal继续active。

完整auth/models分别预检usable/projected/实际gpt-6.1-sol流式；两轮各10次实际请求HTTP200/EOF，总20次，固定600000ms/每轮20请求未延期。自己的73/74/75页已关闭；原前台38440/22764均实际exit0，Native54340/73852、Host63588/69448、18274/18275与配对凭据退休由各closure-readback确认。全部归档检查器终态后才保管对应五个Native文件。

[事实汇总](evidence-summary.json)保留会话及Source身份；完整运行日志分别8878/10383行、未知时间0，无损gzip展开字节相同，原文私有保留。142份公开文本初扫凭据命中0，最终随提交复扫。所有本轮改动与证据范围提交并正常同步上游，未执行发布。
