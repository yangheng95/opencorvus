# 340 Skill 附属文件分页事实

## Recall

用户持续授权自主修复Sources、UI/UX（User Interface/User Experience，界面与体验）和功能，直到明确停止；最新要求只用单agent，旧goal中的Astra委托文本不再适用。339提交4202d9571f43f9dec5826f3c7b589b763916ab77已正常推送，上一轮有实现、真实验收、提交和证据，属于progress。本轮开始git status干净。沿用benchmark-debug-template证据流程；禁止UI自动化，真实页面交互/截图人工查看。凭据使用已授权，实际Provider验收必须成对复制auth/models并单独验证credential/catalog/model/streaming。

338发现、339末复现：实际300行文件，readTextFilePage流式文件路径只返回25行却报告totalLines=26；同内容readTextFilePageContent报告300。旧路径在字节上限break，lines只代表已遍历部分。已读text-file两种入口、ReadTool、createSkillLoaderTool和Skill/MissionSkill两family、Tool.define、Skill.Info/materialize/发现与挂载、transport元数据及04-extensions；全仓只有Skill supporting-file调用异步入口，ReadTool调用内容入口。totalLines经Tool结果持久化与有界transport投影；Skill当前摘要不套ReadTool专用范围，但原始结果metadata仍应真实。

参考Node.js官方[readline行事件](https://nodejs.org/api/readline.html#event-line)：LF、CR和CRLF均为换行，末尾无换行的内容仍构成一行；当前内容入口只按CRLF/LF切分，与文件入口对CR不一致。重复的是分页计数、行长裁剪、字节上限、续读偏移和truncated计算，已经有两份实现及可观察分歧。读取来源（已持有字符串/文件stream）仍各司其职。

## 根因、影响与修改准入方案

现象是50KB输出上限被错误当成文件读取终点。limit上限路径原本继续扫完整文件计数，只有byte路径提前结束；不是Provider、UI猜测或调度问题。两个分支复制同一策略，338只改已载入内容空文件计数，没有根治异步分支。相关生产入口为ReadTool文本、普通Skill和Mission Skill文本附属文件；binary/image/PDF、授权、Skill挂载/物化、附件身份、Tool request/outcome及生命周期不改。当前未出现队列、并发、恢复或终态异常，如有则立即共享机制横向审计。

在text-file内建立一个私有分页collector，两个入口逐行馈入；collector负责真实totalLines、当前窗口、2000字符裁剪、50KB上限与续读。首次触及byte上限后冻结当前窗口，只继续计数，禁止跳过长行再把后续短行挤进页内。返回nextOffset始终等于实际最后返回行+1；offset越界仍用既有明确错误和实际总行数。内容切分对齐readline的CR/LF/CRLF和尾换行语义，空文件仍0行、单换行1空行。删除两份旧分页循环的策略重复，保留既有公共返回字段及工具参数；不加后备路径或第二个计数事实源。

输出内存继续最多一页，文件总行数须读到EOF（End of File，文件结束）。byte上限后I/O会比旧错误路径多，和现有limit上限计数一致；不把完整文件载入内存。原stream/reader finally清理仍保留。原始超长单行的readline缓冲和读取期间源文件变化不是本轮新增机制，不能声称提供不可变文件快照或新取消语义。

## 验收与交付

先增正向真实文件测试并保留旧失败：301行的字节裁剪+尾部短行、精确续读、UTF-8字节边界、空文件/CRLF/LF/CR以及完整越界错误；实际SkillTool与MissionSkillTool在真实附属文件上执行并验证metadata。局部surface配置测试只证明工具契约，不冒充真实UI或LLM。修复后重跑同checker及相邻ReadTool范围/附件契约；后端typecheck/docs。

真实NativeService新建skill-page-340-live-01、localhost:18317/ui。归档/检查步骤预先准备，最多12次实际gpt-6.1-sol流式请求，仍为600000ms固定服务上限和180000ms无活动观察。只在隔离项目安装本轮分页探针Skill并通过现有项目配置挂载，模型用正式skill工具读取长文件第一页和续读/末页，不创建Task或委托。人工检查实际Input/Output、分页说明及完整结尾，后台核对canonical结果301行/实际窗口和Provider EOF。前端源码不变则复用338构建main-HB6Ez6mO.js。第5分钟内完成必需截图并关闭自建页/服务，实际join原启动句柄；保持失败事实，不能靠延长期限或重启覆盖失败。

完成后更新根/月/目录README与当前架构，扫描脱敏证据，精确提交本轮文件；fresh fetch+merge、复核完整upstream..HEAD、运行正常push hook并推送。不发布版本，不结束持续goal。

## 原失败与实施准入

9212原checker实际exit1，11 tests中5 pass/6 fail：字节上限总行数、UTF-8字节裁剪总数、CR和混合换行内容分支、两种Skill-family工具的metadata均复现错误。原日志完整保留。全文件路径与真实工具调用失败成立，准入统一私有collector，原限额和公共返回契约不变。

## 实施结果与真实验收未达成项

42076真实checker实际exit0，3文件19 tests/82 assertions；其中新文件11/30。32153 backend typecheck实际exit0，docs通过。text-file已收敛collector并对齐CR/LF/CRLF。Scope外二进制识别与权限未改。

live-01由原启动30441启动，Native68936/Host23724，页面124；首次准备脚本把SDK声明的/config误写/config/而得到非JSON，未进入配置写入。修正路径后400明确uninstalled Skill：文件已写入但启动时缓存尚未刷新。已通过正式/skill/mounts?refresh=true刷新目录，随后/config PATCH返回200，项目canonical配置和/work/capability assigned_refs都包含page-probe-340。保留400和成功回执，不把这些准备错误当产品分页错误。

真实Sol请求仍只有一次capability_search，模型未得到skill声明，四项分页调用均未执行；完整checker实际exit1（工具数1/预期4）。页面截图01保留实际失败。服务在约4分55秒正常关闭，原30441实际join exit0，5次Provider请求全部streaming/200/EOF，auth/models和整个物理链成对清理。NativeService监督资格通过只代表生命周期完整，不代表本轮分页端到端通过。不得重启或把提示改成@skill来绕过发现的问题。

## 下一轮必须先修复的共享 Skill loader 投影问题

真实证据：Skill installed policy=allow、project config primary_assistant_capabilities.work.skill_refs=[page-probe-340]，/work/capability declares skill，但实际Provider 37个工具声明中没有skill。canonical capability_search使用kinds=[tool]/query skill，只返回skill_market；技能加载器被harnessLeafAccess标记execute-only，因此这类tool发现也无法恢复它。模型自述仅作线索，以上请求与配置才是证据。

已定位SessionLoop.occurrencePermanentToolRefs：routineToolRefs排除skill/mission_skill后，只有productionSkillContext且explicitSkillNames.length>0才加入skill；visibleChatSkillNames来自明确@skill语法，不是任意自然语言Skill名字。resolvePermanentProviderBaseDefinition又以相同explicit长度限制Skill定义；finalizeSkillSurface将activeSkillNames空数组传给ConversationCapability.resolveSkillSurface，会覆盖project assignment，进一步产生空挂载视图。旧task-routine-tools测试将两个Skill loader从期望集合中排除；skill-reveal正例依赖@skill标签，因此不能证明普通配置入口。

尚未完成这项跨角色改动的全影响分析，暂不修改共享投影。下一轮继续读取capability-search-runtime现行契约、routine-tools、所有permanent定义构建/消费和Skill reveal/reconstruction入口，覆盖Chat/Work、Mission及Task runtime不同owner和会话恢复，再落盘实现方案；遵循已授权通用工具直接提供、专业Skill内容按需加载的用户规则。修复后必须用同样普通请求重做本轮实际分页验收。当前产品持续goal保持active，本轮不得声称网页/模型端到端已完成。
