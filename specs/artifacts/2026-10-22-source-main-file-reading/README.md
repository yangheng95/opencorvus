# Main 文件来源往返阅读

[Recall、根因与方案](../../records/2026-10/2026-10-22-source-main-file-reading.md)。526单agent，既有合法Main与真实文件来源；修复文件内容区关闭工作台后焦点丢失，复用标签关闭的共同焦点选择。两个实际开发/ui范围模型0/最大0，不造来源/消息或运行UI自动化。

| 图 | 人工视觉复核 |
| --- | --- |
| [01](01-main-current.png) | 当前Main已有文件来源 |
| [02](02-two-column-sources.png) | 长路径两来源L2:11/L3:15 |
| [03](03-second-source-file.png) | 第3行第15列实际打开 |
| [04](04-first-source-file.png) | 同一文件第2行第11列 |
| [05](05-last-file-closed.png) | 原最后文件关闭：BODY焦点丢失 |
| [06](06-neighbor-after-file-close.png) | 原有Files邻项时关闭：BODY焦点丢失 |
| [07](07-tab-close-control.png) | 原标签关闭对照：Add tool焦点正常 |
| [08](08-after-source-file.png) | 修复后同一来源列定位 |
| [09](09-after-last-file-close.png) | 最后文件关闭回Add tool |
| [10](10-after-neighbor-file-close.png) | 有Files邻项时回Files标签 |
| [11](11-after-draft-close-confirm.png) | 仅内存草稿的真实关闭确认 |
| [12](12-after-cancel-keeps-draft.png) | Cancel保留草稿和原关闭按钮焦点 |
| [13](13-after-discard-returns-files.png) | Discard本次草稿回Files标签 |
| [14](14-after-delete-last-tab.png) | 标签Delete保持原焦点合同 |
| [15](15-after-panel-close-main.png) | 整栏关闭回Main header，来源段保留 |

全部15图实际呈现并人工查看，10为主要修复结果。可见DOM选择/焦点是只读观测，没有DOM、截图或组件断言。原测试文件129字节及mtime保持，两90表156566原行/schema/canonical保持，原93310/3656与原生/输出/request/launcher完整关闭，122/123关闭。没有凭据/模型目录副本或Provider请求。

空工具选择页的打开入口仍有独立BODY焦点线索；本轮未宣称该打开入口、活跃流、全部Rendering、Side或Native WebView2通过。零模型环境的配置不可用提示按预期保留。脚本依赖原413/446工具链及闭合523完整数据，不是独立安装包；完整DB、原私有表快照和运行目录不归档。构建原工具回执可验证成功，未另存完整stdout，不提供伪造日志。
