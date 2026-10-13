# Move 源entry退休依赖修复与Root独立验收

[正式Recall、根因影响与冻结合同](../../../records/2026-10/2026-10-14-directory-target-navigation.md)。用户要求停止所有子agent后，最终产品、原日志和真实桌面由Root独立核验；analysis里的早期独立报告是其各自时间的资格。

修前三个Move已原生发布source，但目的parent依赖退休source，原newPath随后不可寻址/404。当前Move在发布前以准确entry地址/BigInt身份检查目的parent的实际访问链；依赖返回400/FileInvalidPathError，data.path保原newPath。已有健康或dangling目的entry优先409。独立same-target alias保200，Windows junction保外层namespace、symbolic递归替换namespace；普通目录退休依赖及有限root-back均有正向合同。Copy不退休source，没有新增这一检查；共享relocation/future tree和完整目录link浏览仍未实施。

| 原运行 | 正向checker | 真实TCP请求 | 原退出 |
| --- | --- | --- | --- |
| first | link30 + root18；48 pass、628 expect | 188：200×98、400×61、404×25、409×4 | 0 |
| final，诊断修正后 | link30；30 pass、334 expect | 130：200×91、400×13、404×22、409×4 | 0 |

validation保存完整原功能日志与退出、两次source类型检查（均0）和格式结果。analysis/root-acceptance-review.json.gz由Root全文解析全部原日志，分别94条原身份/readlink和42条完整marker正文；未打印的通知/身份断言不补造。小Hono checker原成功requestID=null，完整Server请求另有真实ID。首轮root语义后续未变，不拿首0替代最终link重跑。静态check、这些非UI测试及Native裸库资格不替视觉验收。

真实开发页面为localhost:18456/ui，fixture=fc1edaa2-91c8-45d9-9caa-142d25b87f36，A/B两独立Git根、预声明95B，注册后127B。Root在Files亲自执行5次Move：junction/self、indirect relative、symbolic/self400；独立alias的junction与symbolic200。4个注册、6个before、10个after脚本请求均有原requestID/完整body；clients与directory-target-guard-after保存原input/HTTP/物理dev/ino/birth/readlink/六份完整bytes，成功entry实际在A/data/moved-j、moved-s，独立alias与A/B marker保真。状态reader只作文件/API正向读回，没有UI自动化。

screenshots的11张原JPEG均Root实际查看，1280×720，01初始、02 Files、03–05 junction400 Details、06 indirect400、07 junction成功英语、08 symbolic400中文、09 symbolic成功中文、10 data展开、11完整marker Editor中文。04/05为滚动Details片段，底部闭括号没有完整入图，不能称完整body视觉证明。11的原AX另保存；AX只作原交互上下文，不替图。浏览器原warn/error数组为空。只关闭自己的tab2，没有用户窗口/进程操作。

runtime/evidence保同原occurrence=directory-target-guard-after-c94af314-1bea-42a9-8e4c-5af4c59ddbce，900000ms绝对cap/120000ms真实输出无活动输入、原Host71960/Target26924/Parent51828及各birth、stdout554B/stderr209058B。全文stderr仅3条对应预期400诊断。普通shutdown实际200，Native与launcher自然0，所有joins/writes、physical/output/request settled及birth退休/port释放收齐。tools/shutdown-root-exit.json原exitCode=null是PowerShell `$LASTEXITCODE`未赋值，保原不伪造；实际tool0、原HTTP200、Native/parent0与物理回执分别证明各对象。外层tool返回在chat，未另存binary日志。observer仅透明原Git调用输入/输出/birth/退出，不改Native执行或活动计时。

tools/full-changes.json与history是子agent准备时版本，早于Root透明日志/state-reader修改；tools其余当前文件和source-head/source-diff/file-entry-before-launch保存真正页面启动所用源。source是开发模式与已存不变UI资源，当前Files UI源码未改；不声称其它owner同时修改的Provider界面或安装包已验收。无模型调用、凭据或UI自动化新增/运行。

[archive-manifest.json](archive-manifest.json)覆盖本guard及entry-name共198原件、4167334原bytes，逐件完整gzip或原bytes直接保存；home/auth/models/database不在选件范围。prior-delivery仅保上一检查点020f7b0的原push/fresh证明，不是本产品修复push证明。完整目录浏览、shared相对权限未来树、旧meta/proxy根因、非Windows/UNC/未知native失败与竞态均明确未满足；本交付只资格当前Move退休依赖合同。
