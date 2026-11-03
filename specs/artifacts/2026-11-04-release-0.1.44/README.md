# 0.1.44 发布证据

对应[发布方案](../../records/2026-11/2026-11-04-release-0.1.44.md)。0.1.44 已完整公开，冻结源码 `3827428ac4a17afca8448ec6bca6a3ece1eab270`。

- [正式结果](release-result.json)、[原生运行](native-run.json)、[精确配对官网](website-run.json)：41696667648 原创建 18:44:27Z 至 19:35:16Z，共 3049 秒（50分49秒），包含同运行重试，早于原 19:44:27Z 截止。原生23项成功/6项按矩阵设计跳过，官网41703150989八项全部成功；publisher日志核验其准确返回ID与成功结果。
- [公开回读](public-readback.json)：29项资源、28条上传对象完整性记录、5平台稳定更新与不可变manifest相同，18个官网下载与原生成器完全一致；GitHub正文与冻结根日志精确相同。
- [实际公开Windows包](published-cli-asset.json)：145136793字节，实际下载对象与服务端不可变资源digest一致；原exe版本0.1.44。随包设置日志人工复核见05–08，不以本地开发构建冒充公开包。
- [主机修复资格](native-host-resolution.json)、[Intel正式资格](intel-proof.json)：Ubuntu24浏览器安装及原RPM三项合同/真实载荷隔离安装通过；Intel真实缓存命中、原生编译6分42秒、首次启动和DMG验证通过。首次启动使用realProvider=false，不是完整后端测试或真实模型benchmark。
- [原失败清退](attempt1-retirement.json)、[最终库存](cleanup.json)、[前](release-inventory-before.json)/[后](release-inventory-after.json)：首次未公开空草稿433049038及其旧source标签已精确清退；原19个健康对象保留，新公开对象总20，80份历史日志保持。
- [第二run第一次执行](native-second-execution1.json)、[同运行重试](second-prepare-retry.json)：单Git fetch触及8分钟prepare上限，未claim标签/草稿；完整失败集重跑后成功，原source/创建/截止保持，workflow执行次数2。不能把这次取消或第一次正式run改记为成功。
- [隔离SDK收尾](published-ui-runtime.json)、[正式关闭请求](published-ui-shutdown.json)、[物理退出](published-ui-physical-retirement.json)：页面关闭后POST /shutdown返回200/ok，原五分钟计时器结清SDK监督树，根目录清理于19:32:56.491Z（原截止后10毫秒），随后独立核验进程0/监听0/临时目录已删除。plain pipe的stdin已关闭，close输入未送达，此工具限制如实保留；没有复制认证/目录、发起模型对话或操作用户18571。

|真实截图|人工复核范围|
|---|---|
|[01](01-preparation-web-zh.png)/[02](02-preparation-web-en.png)|200f准备官网，尚无后续Linux基线与新增两项界面说明，只作历史。|
|[03](03-frozen-web-zh.png)/[04](04-frozen-web-en.png)|382冻结来源准备官网，中英八项界面/两项CI说明及限制。|
|[05](05-published-settings-en.png)/[06](06-published-settings-en-limits.png)|公开包的英文设置日志，版本、日期、正文和升级限制。|
|[07](07-published-settings-zh.png)/[08](08-published-settings-zh-limits.png)|同一公开包切中文，真实本地化正文、日期、DB10和macOS限制。|
|[09](09-published-web-zh.png)/[10](10-published-web-en.png)|配对生产部署后的完整中英日志，内容与根对应版本一致。|
|[12](12-published-download-ready.png)|最终官网Windows EXE下载按钮明确为0.1.44；实际18项资源资格来自公开manifest回读。|
|[11](11-published-downloads.png)/[13](13-published-platform-downloads.png)|页面动画/平台菜单动作的中间帧，不作为最终下载页面或展开菜单的视觉资格。|

全部截图为实际页面人工复核，没有UI自动化测试、快照或像素断言；本轮新验证只覆盖发布/日志/首次启动，不扩大为全部模型、运行历史或Side Chat资格。

## 准备与失败历史

- [准备检查](preparation.json)：版号与80份根双语日志、冻结安装、1732包审计、15项版本/日志测试及完整生成；不是发布成功证明。
- [Intel预检](intel-preflight.json)、[实际缓存](intel-cache.json)：199准备源码，19分45秒成功，首次启动4会话/2重启保全、realProvider=false；后续正式冻结源码重新构建。
- [初次准备官网](preparation-website-initial.json)保留真实取消事实；[检出输入调查](checkout-inputs.json)为8df不可变树的86579份specs/3909571358未压缩字节与5805份产品文件/151108220字节，未量测压缩网络字节。原单fetch近15分钟后18分钟build上限取消。
- [中间准备官网](prior-preparation-website.json)：8df说明源码、八job成功。38da稀疏输入的checkout96秒/生成固定点通过，但生产配置资产需要两份规格，原checker正确拒绝；据此修正build只排除specs/artifacts，保留全部current/records。
- [实际Git输入合同](checkout-input-contract.json)：冻结382源码，从原配置checker读取11资产，经真实Git规则全部映射保留，7032文件/173719115未压缩字节；[200f准备验收](checkout-acceptance.json)/[原API](readiness-website.json)保留此前真实完整资格，最终正式配对流程亦已通过。原18分钟build/60分钟总时限保持。
- [第一次正式运行](native-attempt1.json)、[初次owner](prepare-owner-attempt1.json)和[原生主机失败](native-host-failure.json)：41690045392/200f，空草稿433049038；实际Ubuntu26.04.1与产品Playwright1.59.1/RPM6不兼容，18:21:52Z取消。原创建/截止及诊断保留；已精确清退旧空候选，新源码正式资格见上方结果。
