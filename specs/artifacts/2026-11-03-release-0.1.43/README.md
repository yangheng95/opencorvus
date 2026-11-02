# 0.1.43 发布证据

对应[发布方案](../../records/2026-11/2026-11-03-release-0.1.43.md)。[v0.1.43](https://github.com/yangheng95/opencorvus/releases/tag/v0.1.43)已完整发布，冻结源码327501f1cb78cd212fd08a6283ea89d381b77710。

- [正式原生运行](native-run.json)：41511629235，19:37:15Z→20:10:09Z，32分54秒、23成功/6预期跳过，原60分钟预算未重置，仅一次运行。
- [精确配对官网](website-run.json)：41515520408，7分6秒、八job成功；[最终结果](release-result.json)保存publisher唯一返回ID、resolver原source/parent及各平台真实首次启动/安装验证输出。
- [公开回读](public-readback.json)：29资源、28条不可变上传对象完整性、5更新平台、18官网入口及GitHub冻结根日志精确匹配。
- [标签与owner准入](prepare-owner.json)记录初始空草稿；[实际Intel正式构建](intel-proof.json)记录冻结源码重新编译及本次预检缓存命中，首次启动与重启均realProvider=false。
- [实际公开下载](published-cli-asset.json)、[发行包设置运行](published-ui-runtime.json)及[独立退休读回](owned-runtime-retirement.json)：145133372字节，固定五分钟内主动close，原生进程/监听/临时根全部结清；未复制Provider凭据或启动模型对话，传输未量测。
- [前库存](release-inventory-before.json)、[后库存](release-inventory-after.json)及[清退记录](cleanup.json)：原18对象全部保留，仅增加健康43，失败候选与删除均0；79份历史日志保留。

最终实际页面均已人工查看，没有运行UI自动化测试：

- [06实际包英文](06-published-app-en.png)、[07英文正文/限制](07-published-app-en-limits.png)、[08实际包中文](08-published-app-zh.png)、[09中文正文/限制](09-published-app-zh-limits.png)：实际下载发行包的设置日志，含最终筛选说明、DB10与macOS限制。
- [10官网中文全文](10-final-web-zh.png)、[11官网英文全文](11-final-web-en.png)：正式官网20:09:15Z实际激活后于20:09:21Z/20:09:26Z实拍，早于workflow清理终态20:09:41Z；冻结327完整版本日期/正文/升级影响及限制。
- [12官网下载入口](12-public-downloads.png)：真实0.1.43 Windows EXE入口；所有18入口由公开清单实际回读验证。

数据库自动迁移至10并保留用户数据；旧版本不能直接打开升级后的库。macOS仍临时签名、未公证。后续main提交不改变本版冻结来源，未宣称完整后端测试或真实Provider基准已通过。

- [准备检查](preparation.json)：版号与根双语日志、冻结安装、依赖审计、精确15项正向测试及生成/文档检查；不是发布成功回执。

准备官网e0源码的实际页面（非最终发布证明）：

- [01初始加载](01-prepare-notes-en.png)：保留加载阶段，不作为布局通过证据。
- [02英文完整日志](02-prepare-notes-en-full.png)、[03中文完整日志](03-prepare-notes-zh-full.png)：已人工查看43日期、全部正文及升级影响/限制；之后增加的文件修改记录说明仍须随最终源码重新复核。

- [Intel预检](intel-preflight.json)与[实际缓存](intel-cache.json)：41503907975绑定e0，30分11秒成功；firstRun 4会话/2重启保留、realProvider=false。仅预检验证，正式版另从最终冻结源码构建。
- [04更新后英文](04-updated-notes-en.png)、[05更新后中文](05-updated-notes-zh.png)：7432源码完整正文实图；随后新增的类型说明/筛选恢复仍须在最终版复核。
