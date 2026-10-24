# 成员工具切换与正文所有者调查

对应[方案与调查](../../records/2026-10/2026-10-24-member-tool-transition.md)。574由单一开发agent使用自有原生开发服务 `http://localhost:54058/ui/` 手动体验、截图并逐张查看。用户18571实例未操作。

通过用户已授权的OpenAI认证及完整模型目录配对，实际预检证明凭据可用、模型投影和真实请求均为gpt-6.1-sol。原Task内原B在原会话接续一次有限责任，没有新建成员/Task/Goal。两指定W3C入口各一次真实webfetch，自然顺序执行；新增两条Source均与真实完成的Tool及SQLite canonical身份对应。原Task自然完成，原B为29消息/94Part/8网页来源。真实assistant计划662字符，先于两次工具接纳；最终正文1524字符，位于两次工具之后。

| 实图 | 人工观察 |
| --- | --- |
| [01](01-before-stream.png) | 原B历史末段与W3C说明、表格基线 |
| [02](02-dispatch-stream.png) | 原B续接的真实单次许可，未扩大授权 |
| [03](03-reading-plan-stream.png) | 新计划正常流入，原17正文所有者仍保留 |
| [04](04-two-sources.png) | 最终正文与QA574BEND；该画面没有显示Source卡片 |
| [05](05-final-table.png) | Task已完成，最终对照表和属性折行可读 |
| [06](06-source-pair.png) | 两条真实来源的完整标题、域名与相邻正文 |
| [07](07-home-discovery.png) | 另行进入默认首页，Goal入口未在默认画面呈现，作为下一批入口改进依据 |

[evidence.json](evidence.json)包含原始请求结算、公开读取与持久化校验、实际草稿移除→接纳时间、完整原数据比较及明确限制；[owner-observations.json](owner-observations.json)记录人工读取的原17正文owner与内容块数。三个真实Tool草稿移除→接纳分别为7、4、7毫秒，所观察17个旧正文owner及块数保持。没有新增或运行UI自动化测试，也没有因Index存在而修改分组或隐藏Rendering。

15次真实模型请求全部为gpt-6.1-sol流式200，原reader全部EOF。原exec21941已join退出0，native/launcher退出0；公开shutdown200距固定deadline462702毫秒，物理/输出/请求和出生链完整，auth/models副本已清退，源认证元数据与模型原件保持。项目记忆从idle/revision19/覆盖24项自然更新到idle/revision23/覆盖29项，旧覆盖保持精确前缀。

源库90表/197241原行全部字段时间、schema5、canonical及源文件大小/mtime保持。目标原Message/Part/Source事实保持；7行有意变化为memory_chunk、memory_file、两个已到期容量slot及原Task/root/B三个Session的time_updated，不把真实继续执行的控制/记忆更新宣称为零差异。原附件公开读取200/643字节，与实际不可变原件相同。

本批未复现Rendering闪烁，只排除了本次顺序双来源路径中的整体正文owner重建。console收集返回0，故采用实际构建标识、只读DOM身份快照和native Bus元数据，不以缺失日志证明连续性；未排除人工观察间的同owner短暂HTML复位。首次marker检查范围过宽，已用实际HTTP记录中的assistant计划/最终Part及持久字段强化核验，未重启服务或伪造fixture。
