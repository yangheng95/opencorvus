# 281 来源章节次行

[实施前 Recall](../source-location-plan-281.md)。280已推送并确认HEAD/upstream/remote一致、干净后开始本轮单 agent 改动。仅 SourceParts 共用 URL 次行与消息 CSS：真实非空 fragment 在 host 前显示，激活的可访问性名称使用相同位置值；URL 次行最多两行，完整来源地址仍保存在实际 SourcePart/链接/可访问性名称和原 Tooltip 内容中。不从锚点推测章节标题，不改后端或消息/来源身份。

## 实际视觉结果

Before直接复用280真实 [03来源截图](../source-fragment-280/live-02/03-sources-complete.jpg)：两真实章节同名标题/域名，仅提示可以分辨。当前新构建实际dev/ui18225呈现main-ChaeRRWd.js，真实gpt-6.1-sol按[用户请求](request.txt)读取同文档两个章节和原始发表段落的511字符text fragment。Root查看[01章节和长位置](live-01/01-source-locations.jpg)：#examples / #technical_summary次行直接可读，第三条长位置两行省略，后面的真实总结与输入区域正常。旁证DOM几何只保存观察，没有UI断言：前两次行16.2px，长次行32.4px、真实scrollHeight81、lineHeight16.2px，完整值仍为原地址。

[03实际章节点击](live-01/03-target-summary.jpg) 显示 Technical summary 标题与原 #technical_summary 地址；本轮未重复验 #examples 落点，280独立结果保留。Source链接区别于模型总结的普通链接。两次 Tab 从第二Source经第三工具到第三Source，Root在[04键盘焦点](live-01/04-long-location-tooltip.jpg)看见真实焦点边界、两个章节次行和长位置两行，完整激活名包含原fragment与host。

**完整长地址 Tooltip 尚未取得视觉资格。** 04键盘聚焦截图没有显示Tooltip；重开同一已完成会话9并点击第三Source，实际外页10地址完整，关闭10后[05返回截图](live-01/05-long-source-return.jpg)仍没有捕获Tooltip。未把完整DOM/ARIA地址或旧280短地址提示当本轮长提示通过。原因未知，下一轮先审计公共Tooltip/Kobalte焦点与浏览器观测边界，再决定修复；本轮没有按猜测加focus状态、强制open或备用浮层。04文件名沿用了原计划阶段，但事实是focus通过、Tooltip未通过。

01浏览器截图为1280×720浅色，04/05原生返回截图为1093×1244深色；没有修改主题或视口，记录实际提供的两个表面，不宣称同主题像素对齐或全矩阵资格。两个表面章节/长次行的人工结果均可见。只资格本轮Main桌面展示；Side/child共享实现不等于其本轮视觉已验，多来源折叠摘要、原Research Studio全帧Rendering仍未验。

## 真实工具、构建和收尾

typecheck74257与build49274原handle均actual0，新构建68秒，renderer-public-surface声明检查0；纯UI没有新增后端测试或UI自动化，280的12后端测试是独立上一轮结果。刚开始读取误猜dist/index.html路径失败，实际所呈现bundle由真实页面脚本地址确认，不靠猜路径作为交付证据。

本轮正常dev服务600000ms/12累计请求，auth+完整models配对，预检usable/projected/实际gpt-6.1-sol且streaming=true；[backend facts](actual-source-facts.json)关联实际三个工具输入、三个完成结果、原始持久化来源和7个真实Provider EOF/0取消。原前台6377 actual0，Native67100(win32:639272855950761498)、Host67976(win32:639272855942999025)，物理余387890ms，满足提前四分钟目标。自己7/8/9/10页关闭后唯一shutdown，原前台实际join，再独立验证出生/物理输出请求/端口释放和配对退休；所有checker/observer原handle结束后才保管自己五个自产物。

280首次连接失败的自己的错误页1仍因data URL策略无法绑定，未绕过，依临时页规则turn结束清理；不声称已取得它的手动关闭回执。没有操作用户页面或进程、启动多agent/Task/成员。公开AX仅规范行尾空白，原bytes私有保管；原截图/Canonical/Provider与日志脱敏归档。当前可读性改动通过已列视觉场景，长Tooltip未验项和持续goal明确保留，后续单agent继续调查。
