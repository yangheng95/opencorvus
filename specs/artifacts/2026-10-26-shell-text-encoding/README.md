# Shell 文本输出、实时阅读与停止保留

[方案、根因与验收](../../records/2026-10/2026-10-26-shell-text-encoding.md) · [脱敏原事实汇总](evidence.json)

修复Windows Python管道默认编码与产品UTF-8（8位Unicode转换格式）文本消费不一致、用户命令对拆分字符逐块解码、运行/停止后的实际输出未投影到工具正文三项问题。保留原命令、原历史、原取消/失败与进程所有权；原已提交进度生成当前显示，不补写旧结果。

| 原截图 | 人工复核 |
| --- | --- |
| [01](01-original-chinese-error.jpg) | 同一原会话的cp1252错误及退出码1保留 |
| [02](02-live-output-missing.jpg) | 630真实失败：后台已持续保存中文，界面却只显示等待结果 |
| [03](03-command-stopped.jpg) | 630原取消状态及未显示已记录输出的现场 |
| [04](04-user-shell-unicode-result.jpg) | 实际公开用户命令接口分字节写stdout/stderr，完整中文/表情及退出码0 |
| [05](05-restored-recorded-output-en.jpg) | 631新构建冷重开630原取消，Recorded output恢复真实中文 |
| [06](06-live-chinese-output-en.jpg) | 631真实Sol执行同一原命令，实际Live output持续呈现中文 |
| [07](07-stopped-output-retained-en.jpg) | 631人工Stop后中文输出与原Cancelled事实共同保留 |
| [08](08-recorded-output-zh.jpg) | 中文界面的原命令、已记录输出与取消工具组 |
| [09](09-live-output-zh-final.jpg) | 632最终分层环境源码，中文实时输出与原命令执行中状态 |
| [10](10-stopped-output-zh-final.jpg) | 同一次原命令停止后，中文已记录输出与取消状态保留 |

十张实际1280×720原图均人工查看，无修改、拼接、截图基线或UI（User Interface，用户界面）自动化测试。长输出保留正常视口/滚动，部分工具标题位于视口外；最终实时与停止输出均覆盖中英文。真实中英文复制按钮分别返回Copied/已复制，展开/收起有效；未独立读取剪贴板字节。

后端先有5项合格编码失败、2项合格进度投影失败和1项环境层级失败，修后最终56项140断言通过，含原结果/恢复/退出、双项目、真实分字节双流、冷重开与Windows最后守卫层优先。首次进度夹具缺classification（失败分类）的错误单独保留，不算产品红测试。扩大检查器的过长cwd（工作目录）失败追查到私有脚本多余隔离及深TEMP；恢复原canonical runner（唯一现行运行器）与标准受管临时目录后原四项通过，不添加生产路径别名或绕行。

630/631/632分别5/4/4次真实gpt-6.1-sol流式请求，全部200/EOF settled，累计207。原中文命令完全保持，不加-X或包装，分别留下86/157/61行真实进度；退出码1由人工Stop产生。公开session.shell API（Application Programming Interface，应用程序接口）的实际分字节命令退出0，并在真实页面读取，不能称UI直接命令提交通过。

四个原命令进程精确身份及terminal/output/settlement（物理终态/输出/请求收尾）均结清；三服务shutdown200，原exec65908/7638/75439/native/launcher（原生宿主/启动器）均0，提前682681/600296/764743ms关闭，配对认证/完整模型副本退休。三次源92表16606/18813/20954行、目标484/541/600条关键事实保持，仅原Chat活动时间推进，schema（结构）仍8，原附件保持。未操作用户18571、用户数据库或窗口，未修改版本/发布定义。
