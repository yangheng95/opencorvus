# 0.1.39 发布与失败候选清退证据

cleanup-plan.json为删除前真实GitHub库存、唯一run/source、完成结论、tag指向和14项公开版本保护集。cleanup-result.json逐项记录11个未公开候选的Release、tag和精确原生owner运行删除后实际HTTP404，最终草稿为空、原14项公开/稳定通道ID、时间及资源数量完整保留；不是据标题猜测删除，也没有改写Git提交历史或删除已公开35。

v0.1.39已由冻结source23dc97f2f83f8fbe614d61015a20652235ec0377正式发布。原生41007306793创建2026-10-30T05:14:25Z，05:45:55Z完整success，31分30秒；23成功/6预期非Linux分支跳过，五GUI/五CLI、六Linux格式和两完整安装row全部通过。GitHub于05:38:34Z公开29资源。唯一配对网站41009576597成功；其main事件head为b1bc9713，但resolver实际SOURCE_SHA=23dc/RELEASE_RUN_ID=41007306793，publisher日志05:45:33.390Z确认其在原40分钟内完成。native-run.json、website-run.json及native-source-pairing.json保留实际API/日志，不把main事件head当发行源码。

public-readback.json记录独立公网checker实际exit0：不可变tag/source、双语正文精确冻结根日志、29上传对象、五平台签名更新与稳定通道、18官网入口，以及28校验条目与服务端实际上传对象digest一致，SHA256SUMS自身下载字节也匹配上传对象digest。校验对象是不可变发行资源，不是用可变源码摘要替代功能验收。

Intel预检41004280047/source5e4107e8361b13a6a5bea51467f736bbccf0c4b1实际success，20m18完成，firstRun4/跨重启2，Rust9m54；main缓存9739814437/e83e704d已实际保存并经缓存API核对。intel-preflight.json及intel-preflight-proof.json只证明依赖预检与缓存。正式39的Intel日志另证实际命中同一e83e704d、从本次source重新构建、firstRun4/跨重启2和Rust6m38，没有采用预检安装包。

ci-readiness.json保留审计修复后1737包/0通告，以及原隔离checker三文件25pass/113断言的实际完整输出；包含真实Git私有快照/原用户index、SDK Node adapter/middleware/HTTP字节及两个Solid父级序列化器。首次误用裸命令的22pass/3fail也原样保留，明确两个5秒超时来自错误runner调用、一个是升级后错误类型合同变化；没有放宽原checker的60秒期限或回滚生产实现。不将这些聚焦合同当完整后端三平台全量CI通过，也没有UI自动化测试。

selected-ci.json及selected-ci-proof.json记录冻结source23dc的41007309932三平台定向CI完整success，13m03完成；Linux/macOS/Windows分别在原checker中完成三文件exit0。8成功/1预期dependency-review跳过。没有将其扩大为完整788文件后端CI通过。

01–10为同源官网双语日志原图，已实际滚动与人工查看；10补齐中文升级限制完整区域。11–13为实际公开Windows baseline CLI中的随包/ui设置日志，原生--version实际39、页面Current version v0.1.39及Oct30日期、新增、修复和限制均完整可见。published-cli-asset.json证明144415720字节真实公开下载匹配上传对象digest。14保留主页初始加载帧，不作为激活证据；15为加载完成后的实际Windows/x64/EXE/0.1.39按钮及精确GitHub39安装器链接原图。未修改图片或DOM，无UI自动化测试；应用仅实操英文，官网两语言均实操。

published-ui-runtime.json保留新临时HOME/OPENCORVUS_HOME、无复制认证、实际52633端口/版本/原5分钟期限与关闭观察。没有发起模型会话，未观测Provider传输计数。SDK自身owned-tree close已返回；之后实际CIM进程与端口监听均0。首次rm因helper自身cwd仍在目标目录产生EBUSY，helper已退出；在工作区验证普通空目录后仅做非递归删除，已退休该精确临时根，未重开实例或延长期限。下载首次Bun响应体等待未结算，精确核对自有PID/出生/命令后关闭，改为有进程期限的GitHub下载器；保持原完整性和原对象验收，原因未知，不归为产品或发布失败。

发布链接：[GitHub v0.1.39](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.39)；[中文日志](https://opencorvus.com/zh-cn/changelog/0.1.39/)。当前GitHub草稿为空，原14项公开/稳定对象和新增39均在。

详情见[发布记录](../../records/2026-10/2026-10-30-release-0.1.39.md)。
