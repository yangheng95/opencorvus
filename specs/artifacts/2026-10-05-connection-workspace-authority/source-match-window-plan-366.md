# 366 超长搜索行的命中预览

## Recall

用户要求持续单agent自主改善UI/UX、功能与Sources，旧goal的Astra委托被最新人工要求覆盖。365为progress：真实旧网页摘要Main/Side/history/宽度/Files标签恢复14图、原12 Message/12 Source/5 Provider全行相等、Native240678ms内exit0，81a5bac5a已正常推送；未证实新的摘要丢点，所以没有推测性源码修改。工作区干净，所有365运行者关闭。364文件snippet与工具输出单源、Unicode完整字符及脱敏合同已交付c77f593ae。359首次复制未知保留，goal active。

已读365/364 Recall、grep.ts/grep.txt完整路径、SourceParts四行文件Tooltip、Source schema/factory/persistence、07-panel、Ripgrep.parseSearchOutput/Match/WireMatch/decodedText/searchHost、find.text路由/CLI调用与SDK生成入口。全仓rg查parseSearchOutput/Ripgrep.Match/submatches/MAX_LINE_LENGTH，当前parser只被search_code和searchHost使用，后者由/find和debug CLI调用。相关test为ripgrep-protocol和search-code-bounded-execution，均工具/协议契约，不是UI自动化；不新增或运行UI断言。

## 问题深度与当前事实

search_code当前始终lineText.slice(0,2000)，即使实际命中在更后位置，也返回前缀。364给Source增加相同片段，因此工具与Source会一起缺少可辨认的命中内容；它修正了字符边界与片段缺失，但未改变原行首截断语义。新问题从代码可明确推导，实施前必须用真实文件/当前工具正向期望跑出原失败。

原始ripgrep JSON已有按位置排序的submatches，start/end是原lines的字节偏移，base64编码行也以解码后字节为准（[官方JSON文档](https://docs.rs/grep-printer/latest/grep_printer/struct.JSON.html)）。当前parser把非法UTF-8正文按现有规则显示为替换字符；将显示文字重新编码后套原byte offset会错误定位。不能用JS正则重新搜索或indexOf匹配文本猜位置，也不能改公共/find返回的byte offset含义。

## 单一实现与影响面

parser仍唯一验证JSON与解码；内部parseSearchOutput返回每项的规范data与原lineBytes。原wire bytes只在解析边界保留，规范文字从同一字节事实解码；这不是第二次文件读取。searchHost明确返回data，保持/find及debug现有完整公开Match形状，不扩大SDK/API字段；search_code在同一解析项上把首个实际submatch字节前缀解码为显示位置，然后只保存该位置及lineText。所有调用点和对应协议测试同步改为这个唯一内部返回形状，不保留旧内部返回/fallback。

短行完整保留；超过2000 UTF-16编码单元的长行，窗口从首个实际命中前最多40编码单元开始，以同一2000预算截取。被省略的左右端分别加现有省略标记，使靠后的匹配在片段开头附近，文件Tooltip四行内可辨认。开始/结束都避开代理对中间；零宽命中和超过预算的匹配仍按实际位置与有界文本规则处理，不能承诺展示完整无限匹配。没有submatch的合法协议记录按行首处理（官方允许倒置匹配空数组），不推断关键词。源码配置只用工具已有显示预算层集中常量。

进一步审查发现中段窗口不能沿用“先截断后脱敏”：如果窗口起点位于data URL payload内部，会丢掉其头部识别信息。因此必须先用既有redactInlinePayloads处理完整匹配行，再选安全窗口。为保持真实匹配位置，在现唯一redactor增加可选onReplacement(start,end,replacement)观察回调；其三个既有替换分支共享实际替换点，调用方将匹配位置按真实替换区间平移，落在被替换载荷内时指向省略标记起点。全部既有调用仍得到同一string与同一默认处理，不建第二个扫描器或shadow结果。全仓已查decision-log、codebase-tools、memory、bash/diagnostic-value/read/skill/tool-failure-cause及grep调用，没有其它使用该新回调；完整行进入原有2MiB总输出预算，未增加文件读取。短行默认原脱敏输出保持；长载荷的marker现在反映完整载荷长度而非行首截断后的部分长度，作为本轮明确合同变化记录。

同一安全snippet用于Tool输出和Source，最终全串脱敏仍保留。Source身份/path/range/顺序、持久化不可变合同不变，文件导航仍打开原始完整行。匹配字节位置属于解析事实，不新增UI状态或模型流程gate。Ripgrep.searchHost的公开data、忽略/include/结果100限制/Process执行期限与2MiB输出预算保持。无调度、队列、恢复或权限修改；发现此类异常立即按共享机制全入口/轮次/终态/重启重试/串并行/多项目横审。

风险：Unicode字节与UTF-16不同、无效UTF-8前缀、UTF-8字节模式落在字符内部、匹配在行尾/零宽、窗口两端代理对、片段中内联载荷。原data仍完整按既有UTF-8显示解码；原字节前缀的显示长度用于附近窗口，40单位上下文与完整字符边界保证不把字节offset作为JS索引。实际短行、原首命中、长行靠后、Unicode/无效字节、零宽末尾与脱敏正向用例必须证明明确输出，不添加以“不出现”为核心的负向断言。

## 验收与交付

先增加真实搜索正向用例并运行原实现，保存失败；实现后重跑相关ripgrep协议与search-code工具测试（真实文件/Process路径），必要Source持久化检查。全类型、overlay正式build和docs只补充结构资格。真实UI使用独立source-match-window-366/18366固定600000ms NativeService、12累计请求、成对auth/models与usable/projected/actual gpt-6.1-sol streaming preflight。真实Main/Side搜索自建长行里的靠后匹配，观察文字预览、Unicode、原文件正确行打开和当前列表密度，手动截图亲自复核；不合成Source/消息，不派遣成员。

关闭自己的页面后公共shutdown，原handle实际join及Host/Native/output/request/port/auth-models配对清理，不能延长或重开scope。保留改前失败及当前ToolOutcome/Source/实际Provider/HTTP证据，真实checker核对源文件与安全窗口、模型流式与物理闭合；无UI自动化或源码摘要验收。spec当前合同及根/目录/月索引、docs/architecture检查、范围commit、fresh fetch/merge、完整待推送审查及普通push。无版本更新/发布/新branch/worktree，持续单agent active。

## 改前实证与实现

原runner59933实际exit1：14原测试通过、4新增真实文件测试失败。差异明确是靠后Unicode匹配仍取p前缀、无效UTF-8前缀仍显示替换字符前缀、末尾零宽匹配仍取行首、payload marker只记录行首截断后1978字符而非完整3012。完整日志保留。根据已经落盘的分析实施了唯一parser内部data/lineBytes、redactor实际替换回调和grep窗口；新增匹配位于载荷之后的正向输出对照，以及三类redactor回调/原输出合同。无UI代码或SDK协议更改。

首次修后runner81675的协议/脱敏/持久化通过，工具仅零宽期望失败。进一步实际rg --json '$'的原输出明确submatches=[]，不是实现忽略了末尾跨度。修正原验收中的错误假设：无报告跨度的零宽命中遵守已定义的行首上下文；不根据'$'关键词猜位置、不换JS正则或加第二次搜索。该正向测试改为明确的2000单位原行首输出，原两次失败日志与zero-width-protocol.jsonl完整保留。原4失败中3个证明本轮缺陷，第4个是错误的零宽末尾期望，不把它宣称为已修复产品bug。

## 最终片段的二次实际校验

第一实际scope已完成：5个文件Main/Side搜索、8手动截图与find.text真实API原合同，9Sol流式EOF，原35110实际exit0/254549ms闭合。但最终代码复核发现裁切本身可能形成新的raw-base64识别边界：完整文本token以普通字节开头，窗口从其内部PDF签名开始，原全行redactor不会将前者判为binary，而最后Tool全串redactor会替换后者。新增真实文件工具用例runner13546准确复现：Tool已显示raw_base64省略标记，但Source仍是裁切后的原token，两个通道的安全预览不一致。原失败保留，不能用第一scope正常5例掩盖该新边界。

根因和最小补全：全行redaction负责跨窗口载荷边界及真实匹配位置映射，形成有界窗口后必须再通过同一个redactor，才能让新边界也形成唯一安全snippet。只有这个最终snippet进入Tool与Source，既有Tool全串防线继续保留。没有新增扫描器/规则/fallback，也不改变公开/find原文契约。追加真实工具正向回归；最终另开全新source-match-window-366-edge/18367固定600000ms、8累计请求，原scope绝不延长或重开。使用已授权同一完整凭据/目录pair，fresh preflight后真实UI检索前五类输入加一个裁切签名输入，最终六类Source人工截图核对及持久化/ToolOutcome checker。只需Main新增调用，前一scope的Side同组件正常窗口作为既有独立覆盖，不能冒充最终特殊窗口的Side实测。

## 最终验收结果

最后search_code runner99379 exit0，20/20；协议8、redactor3、持久化1已实际通过，共32个聚焦正向用例。前面的59933/81675/13546失败全部保留，83484的19pass是补充边界前的阶段结果。全类型57744与最终99829均8/8 exit0，overlay正式build70495 exit0/56.51s及renderer检查通过，实际产物main-C_UK_gz4.js（本轮无UI代码变化）。公开/find真实SDK请求HTTP200，4个完整结果逐值对应输入文件的完整解码正文、原line byte offsets和原公开形状；内部原字节未改变API契约。

live18366的Main5/Side新2/Side继承5，checker12条Source逐值对应真实输入与ToolOutcome，9次gpt-6.1-sol流式EOF。01–08实页亲自看过：短行原缩进/emoji、载荷后命中、完整载荷省略、无效UTF-8前缀后的命中、2500单位之后的中文命中均可辨认，最长预览四行；06打开原中文长行第1行；07–08中文Side同样可读。原35110实际exit0、254549ms内闭合。

最终edge18367在新的8请求预算内完成6真实来源和5次gpt-6.1-sol流式EOF；09–14全部亲自查看，特殊裁切源显示92字符raw_base64省略标记（offset3/payload2000），其余五类预览仍正确。edge checker逐项比较真实SQLite/ToolOutcome/完整输入字节，6个最终Source与工具行同一安全snippet；原98870实际exit0、122549ms内Native/output/request与配对凭据清除完成。两个scope均固定600000ms，页面均关闭，未重开原scope或扩期。

本轮总14张截图与32聚焦用例仅覆盖所列桌面/协议/工具路径；最终特殊裁切例没有Side独立调用，初轮Side的正常窗口是独立已验范围。零宽无reported span继续显示有界行首，不伪造末尾定位。Source规范身份/原文件行导航保持，版本/发布不变。接下来文档索引、当前检查、范围提交与fresh merge/push，持续单agent active。
