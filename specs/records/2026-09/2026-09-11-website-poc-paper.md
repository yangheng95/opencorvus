# Website publication of the compiled PoC paper

## Recall

- 用户要求把编译论文挂到OpenCorvus网站，标注“PoC版本Under Construction”；论文源码不进入main，源码分支后续可能彻底移除。此指令授权本次网站发布和编译PDF进入现有网站交付面，不授权删除源码分支、重写论文、运行实验或将论文分支合并main。
- 起始工作区干净，论文分支443a614edca5ea8ebe7a85614225b7f8f807081d；main及origin/main为623ff94fbbb76aa6eecc09c5d708b727ff84b9cd。该main树与论文前bd2d6bd1一致。仅从已审查论文提交读取编译PDF，永久放入网站自身public目录；构建与下载不依赖源码分支。
- PDF为16页、4472337bytes，SHA-256 7fb7ff656cdb85971e53920a81c604da203f039008500cf6cc34e38edb6371c5；内容不修改。标注Proof of Concept（PoC，概念验证）工作稿，Under Construction，不称正式发表或完整实验验证。
- 已读AGENTS、论文最新Recall、网站架构public-website.md、Astro/package配置、OcLanding/OcHeader/OcFooter/OcLayout、现有部署workflow及最近成功部署34426966205。全仓检索确认现有网站由main变更触发GitHub Actions，构建静态client并通过签名RackNerd激活发布；无.openai/hosting.json，不迁移托管。
- 全仓检索新论文没有网站入口；旧squad-compositions里的自写论文Mission是产品任务示例，与本PDF不同，保持原样。独立agent反馈：无；首次本地验证后委托未参与实现的agent只读审查，不再委托。

## 影响分析

现象是已编译论文仅位于计划删除的源码分支，网站无法独立访问。直接原因是public静态目录没有PDF且导航和主页没有入口；旧Git隔离修正保护了main源码边界，但没有建立可独立存活的公开产物。当前应把编译PDF作为网站静态资产发布，入口在中英文首页研究区域和现有导航/页脚。无需增加API、数据库、模型调用、动态下载服务或构建期LaTeX。

影响范围为packages/web的静态PDF、新研究区域、导航/页脚，以及发布记录和索引。部署流程沿用现有签名发布；不把specs/artifacts/opencorvus-paper/manuscript、templates、tex、bib、图源或写作脚本带回main。本轮网站代码与记录在main单独提交和推送，严禁合并论文分支或从该分支cherry-pick整批交付。源码分支当前保留。

检索暴露了两份现存UI源码断言测试tokens.parity.test.ts/style-discipline.test.ts以及qa/restyle/shoot.ts截图基线采集器。按AGENTS第四节删除这些测试、截图采集脚本和package对应命令；tokens.reference.json仍被历史设计资料作为人工参考，且测试不读取它，因此保留该参考文件，更新tokens.css中的过期测试说明和旧restyle文档的历史状态；保留运行时CSS值。该清理只覆盖已实际发现的文件及引用，不扩展扫描其他测试。所有实际UI验收以独立页面交互、截图和人工查看为准。

## 实施方案与验收

1. 从固定论文提交导出main.pdf字节到packages/web/public/papers/opencorvus-poc.pdf，验证摘要，脱离源码分支存活。首页增加可定位的research区域，中英文说明、显著“PoC Version · Under Construction”和阅读PDF链接；使用现有设计令牌，导航和页脚链接到状态说明所在区域。
2. 在main执行网站check/build和docs:check；查看实际中英文桌面浅色/深色页面、实际点击论文入口和PDF链接，HTTP下载核对application/pdf、字节数和SHA-256。不得用源码断言、DOM/截图基线自动化测试替代视觉验收。内置浏览器/node_repl因ACL初始化失败，使用现有Node/Playwright启动独立Chromium进行逐步页面操作与人工截图检查，不操作用户窗口。
3. 独立agent只读检查完整差异、源码隔离、状态文案、PDF身份、实际截图和构建记录；修复有效问题后再审。所有新增spec同步根/月份索引。
4. 仅提交本轮网站范围到main，fetch/merge并检查upstream..HEAD每一提交后push触发既有生产部署。按精确commit关联部署，取得在线中英文页面和PDF下载的实际证据后交付；不将已push或workflow排队当作已上线。后续源码分支删除不会破坏网站PDF。


## 本地检查进展

- 内置CUA提示trusted Node process exited；node_repl初始化sky失败并明确报Windows sandbox apply deny-read ACLs。没有修改权限或连接用户窗口，改用Node v24.15.0交互会话及现有Chromium1223创建独立headless页面，已实际打开线上主页。后续截图仅为逐步人工验收，没有UI测试/基线断言。
- 首次Astro precheck在market:data失败，收到schema_version=2与旧capability projection字段不匹配。按CI现有步骤重建SDK后错误仍在，因此排除“仅SDK旧产物”的初始猜测。直接调用真实Registry解析器确认仓库payload的117/117包均成功。manager.ts的payloadMarketSnapshot会调用marketInstallationScopes→discoverAvailable，把本机已安装包纳入构建读取；使用既有OPENCORVUS_HOME独立临时运行根目录重跑，不复制凭据、不更改用户安装或生产代码。

- 隔离运行根目录后market:data成功；Astro唯一错误是缺失本地downloads/latest.json。按生产workflow读取公开GitHub Releases并调用既有generate-website-download-manifest.ts生成v0.0.63-beta下载清单后，网站check通过（87文件，0 errors，0 warnings，21条既有hints）；docs:check通过（339 ops，25 groups）。没有新增兼容路径或修改产品逻辑。
- market:data刷新了两份既有网站生成快照（分发119→121、推荐包版本），其对应payload在main已存在，本轮不负责调整市场数据。起始工作区干净，差异已读取并备份到临时目录；构建与视觉验收后仅精确恢复这两份生成快照，不混入论文发布提交。

- Astro生产构建完成（117个HTML文件、搜索索引、sitemap）；public及dist/client的PDF摘要都等于7fb7ff65…6371c5。完整build随后在既有copy-landing-downloads.ts失败：本机packages/overlay/dist-artifacts/windows-x64目录存在但无有效安装包。生产CI干净检出没有该本地目录，既有discoverLandingBinaryDownloads明确允许空来源（最新线上34426966205成功）。本轮不删除用户安装包目录、不伪造安装包、不改写下载契约；完整打包验收以同一提交的生产CI结果为准，当前只称Astro构建通过。独立Astro dev已在127.0.0.1:46431启动。

- 开发页面最初出现bun:协议错误遮罩；真实进程显示由Node执行Astro，无法加载网站bun:sqlite。只停止本轮创建的PID 202152服务，使用bun --bun run --cwd packages/web astro dev --host 127.0.0.1 --port 46431（ASTRO_DEV_BACKGROUND=1，OPENCORVUS_HOME为本轮临时目录）重启本任务服务后首页/API正常响应。没有改动生产代码或用户进程。
- 人工浏览器验收：1440×1000中英文桌面，实际点击Paper/论文、两种语言页脚论文链接、主题按钮及阅读按钮；锚点到#research，阅读按钮新标签打开/papers/opencorvus-poc.pdf。HTTP返回200、application/pdf、4472337bytes、SHA-256与原件一致。中英文浅/深主题截图逐张查看；中文页英文标题误用oc-cjk-spacing已移除，并补lang=en，重新截图确认标题两行清楚，PoC状态与按钮完整。截图保存在本轮系统TEMP目录opencorvus-poc-website-*.png及opencorvus-poc-final-*.png，均为人工验收证据，不是回归基线或自动UI断言。
- 标题修正后网站check再次通过（87文件、0 errors、0 warnings、21 hints）；git diff --check通过。已精确恢复两份生成快照。论文源码分支仍为443a614e，main仅新增编译PDF及网站入口/关联文档，没有引入tex、bib或论文图源。完整生产CI与线上验收仍待推送后执行，当前未宣称已经发布。

## 独立审查

academic_review_round2（未参与网站实现，用户已允许默认模型）只读审查全部16项暂存差异、四张中英文浅深实际截图、构建记录、部署输入与源码分支边界。独立比较工作区/索引/443a614e原始PDF及dist产物，确认16页、4472337bytes和完整SHA-256相同；审查结论为无需要修正的有效问题。确认本机安装包目录故障属于既有路径，必须取得本次生产CI和线上证据后才可宣称上线。审查未改文件、再次委托或运行实验。

## 生产发布收据

- 网站提交：`29d3d87af3c0f7a0b6351298c81357609b79f6d9`，main及origin/main已同步，完整pre-push检查通过，未使用跳过hook或强制推送。源码分支codex/paper-preliminary-results及远端仍为443a614edca5ea8ebe7a85614225b7f8f807081d。
- 对应[生产部署34516812585](https://github.com/yangheng95/opencorvus/actions/runs/34516812585)结论success：完整网站build、三平台canonical archive检查以及sign and deploy RackNerd release全部成功。本机完整build的安装包目录限制已由同一提交在干净生产环境中的完整构建结果补足。
- 公网读取时间（UTC）：`2026-09-10T18:56:40.723465+00:00`。英文主页https://opencorvus.com/与中文主页https://opencorvus.com/zh-cn/均返回200 text/html；[论文PDF](https://opencorvus.com/papers/opencorvus-poc.pdf)返回200 application/pdf，4472337bytes，SHA-256 `7fb7ff656cdb85971e53920a81c604da203f039008500cf6cc34e38edb6371c5`，与已审查原件一致。
- 在全新独立Chromium页面实际点击线上Paper入口、PDF阅读按钮（新标签页）、中文语言切换及论文入口。对应地址为https://opencorvus.com/#research和https://opencorvus.com/zh-cn/#research。逐张人工查看线上中英文截图（TEMP/opencorvus-poc-live-en.png、opencorvus-poc-live-zh.png），确认完整标题、PoC Version · Under Construction、说明和下载入口正常显示。
- 本轮论文网站发布完成。只托管已编译PDF，不依赖源码分支，不删除源码分支，不重写正文或新增实验；这不是论文研究完成或长期社区采用目标达成的证据。
