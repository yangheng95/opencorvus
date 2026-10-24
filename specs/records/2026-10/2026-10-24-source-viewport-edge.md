# 来源在视口边缘的尺寸恢复

## Recall

580继续单agent自主排查Sources/Rendering和默认布局，最新“只在冲突的时候等待”持续适用。578布局544058b18与579正文字符锚点7abad3e86已范围提交；前者25文件17图，后者16文件7图，真实原生页面通过关键路径、全部模型0、native/launcher/exec和物理/输出/请求均闭合，原90表207330行原字段/时间保持。原高频Rendering仍未复现，不宣称根治。用户18571窗口/服务/库不操作，不新建branch/worktree，不委派。

两个提交待正常push，实际阻塞是另一会话新增Worktree事件、global/publication路由尚未同步OpenAPI/API文档；原类型冲突已修，类型检查8包通过。docs:check实跑失败，未生成或混入别人的接口产物，不绕过hook；该写入契约收敛即重跑。保留后台所有改动、171无关删除与既有缓存目录。

重读579 Recall、源码和图06/07，当前07-panel、共享capture/resolve字符/来源分支、setupAutoScroll原生输入/宽高通知/restore收敛、Main虚拟定位及Side/成员位置存取、SourceParts实际数据身份/复制焦点。全仓搜索Source anchor定义与调用，三读者共用一个resolver；当前类型仅UI内存。沿用已读computer-use与benchmark-debug-template，不新增/运行UI自动化测试。

## 修改前深度与影响分析

现有合格证据：579明确聚焦的Tabs Source offset271.75，在105%→160%时仍271.640625，可见且身份正确。该offset小于新height440，尚未覆盖靠近旧视口底部的来源。现象尚未复现，只是覆盖缺口。

直接候选触发是来源保存的正向像素offset大于缩小后的viewport高度。当前resolver不区分“保持原位置”和“原位置已落到视口外”，仍按旧offset写唯一scrollTop；后续capture若Source已不可见，会改选正文。若实页确认，根因属于可见性约束缺失，而非Source数据/模型消失或Markdown Rendering。

相关影响包括三共享读者、来源title/snippet/复制焦点、宽度换行导致卡片增高、缩放导致viewport变矮、超高摘录与Main虚拟历史。正文字符通常靠近视口上缘，但沿用旧字符且上滚后可在下方，其边缘合同同样需分析，不能盲目改所有offset。背景Task/Mission/Session调度与schema不涉；若出现共享执行异常另横审。禁止用自动scrollIntoView增加第二滚动writer、隐藏Source、改原文或fallback。

## 实页调查方案

先不改产品。复用579最终已完成Node私有观察UI main-DVohYl6w.js（生产逻辑对应7abad3e86，只加实际capture/resolve元数据）。fresh原生54069、完整原闭合577的90表207330行/schema6及canonical/PNG，按当前checker已声明7正常升级隔离目标；复制完整models但无auth，模型预算0，无新消息/Task/Goal。启动前检查当前迁移一致性，20分钟原生边界、至少五分钟提前shutdown，180秒启动无活动。原用户环境保持不操作。

真实原B中点击Tabs复制控件聚焦Source，再用实际上滚将该来源放到可见区域靠下位置；截图并记录其真实相对offset，不能直接写scrollTop/模拟事件。用产品现有Zoom放大，使viewport高度缩小，人工检查是否仍可见。若来源确实出界，再记录控制流和新可见性合同后改唯一resolver；偏移可保持时继续保持，无法容纳时在同一写入路径内使锚点可见。超高内容如何定义必须由实际边界及现有容器语义决定，不硬编码像素阈值。

修改后fresh scope54070重新构建并复验相同原来源、同位置和字号动作，至少补正常中部Sources和正文字符不退化。截图均实际呈现并人工查看；DOM元数据只支持观察，无UI断言。完整原字段/时间/源字节mtime/配置保持、实际原生HTTP/Source/附件验证，全部scope/exec/native/launcher/物理/输出/请求/出生链闭合、catalog清退。范围提交、fetch/merge/待推送集合审查及正常push，不把接口冲突当其他独立工作停工理由。

## 真实复现与根因

复用579最终已完成UI，真实54069/页254、Task恢复完成后打开原B。点击Tabs复制按钮后实际up0.4，图01来源仅部分落在下边缘，随后down0.15，图02使标题和URL完整可见。生产capture来源身份对应msg_g0VYx2r1y00VGC049Rqk，offset455.671875、viewport380×576、top28133、scale1；没有直接写scrollTop或合成滚动事件。

实际End到160后图03来源标题位于屏外，生产resolve仍按Source offset455.671875得到top58279.96875；新viewport448×440。下一capture变为同Message的正文block12/character52，证明不是来源保持。真实Source实体仍在DOM：top735.984375/bottom825.5625/height89.578125；viewport top280.34375/bottom720/height439.65625，Source相对top455.640625已完全在下方。这是旧像素目标不可行而resolver仍照搬的可见性缺口，与Source事实、Provider或Markdown owner无关。

实现只替换source分支唯一offset计算：设available=viewport.height-source.height，将原offset限制到[min(0,available), max(0,available)]。能完整放下的卡片保持在视口中；更高卡片允许视口留在其内部，避免无条件跳到开头。原offset在可行区间内时精确保持。此约束对应[CSSOM View草案的nearest块对齐](https://drafts.csswg.org/cssom-view/#determine-the-scroll-into-view-position)的几何目的，但仍由现有唯一scroll writer执行，不调用scrollIntoView，不添加事件、Observer、计时器、影子状态或数值阈值。Main/Side/成员现有source resolver调用自然共用；text/tool字符分支保持本批已核验合同。专用超高Excerpt的视觉资格仍需实际页面，不能由公式宣称已验收。

before公开shutdown200提前938043ms、原exec4951/native/launcher0、physical/output/request/精确出生链闭合，catalog退休、页254关闭。真实HTTP/生产parser原B33消息107 Parts9来源及附件643字节正确，关闭后90表207330原行原字段时间/源字节mtime/配置保持，schema6→隔离7按当前迁移正常执行。才开始本UI utility和架构的最小修改，随后fresh after54070复验。

## 修改后真实复验

最终Node正式私有观察构建main-Bx3pGZMu.js/82秒、overlay typecheck exit0。fresh54070/页255，原Task恢复完成后打开B，真实同一Tabs复制按钮、up0.4/down0.15动作，图04与before图02的Source身份、top28133、offset455.671875、380×576、scale1完全一致。

图05实际End160后，Source锚点保持，offset调整到349.640625；实际Source top629.984375/bottom719.5625，viewport top280.34375/bottom720，卡片完整可见。生产resolver仍从原offset455.671875计算，但用现有一次restore写入top58385.5625（实际scrollTop58386），没有外加scrollIntoView或第二校正writer。旧图03同卡片曾top735.984375/bottom825.5625且随后capture退成正文，根因修复证据完整。

进一步160→80→100，记录Source offset349.671875；图06再到160仍同Source/offset349.640625，证明可行位置保持。随后相同原ReConcile段落真实点击及滚轮，character208、offset-7.953125；图07到160仍208/-7.96875，正文字符合同保持。7图均实际呈现人工查看，元数据只辅助解释，不构成自动UI断言或截图基线。

Main虚拟历史、独立Side、超高展开Excerpt、文件/文档来源、极短视口、778实窗未独立覆盖；原高频Rendering仍未知。Source数据、复制协议、text/tool字符分支、schema、配置、后端消息与队列均未改变。

## 资源、原数据与交付

before原exec4951、after44601均join exit0，native/launcher0、physical/output/request/精确进程链全部闭合，公开shutdown200提前938043ms/796549ms，模型0、无auth，两catalog清退，两自有页254/255关闭。真实原生HTTP/生产parser核对原B33消息107 Parts9来源及原PNG200/643字节；关闭后90原表207330行所有原字段/时间、源字节mtime/canonical保持，schema6→隔离7/integrity ok，目标新增迁移事实单独记账。迁移1–7及用户数据库未操作。

本批范围只含该utility、当前面板架构、记录/七图/evidence和三索引；另一会话后台与API生成、171无关删除和缓存目录保持。文档检查及正常push若仍受未同步的OpenAPI/API参考阻塞，保留具体失败，不绕过hook、不宣称已推送。契约收敛即fetch/merge/审查全部已授权且验证的待推送提交并重跑正常push。
