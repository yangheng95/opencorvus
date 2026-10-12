# 2026-10-13 超长搜索行的真实命中预览

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-match-window-plan-366.md) · [完整证据](../../artifacts/2026-10-05-connection-workspace-authority/source-match-window-366/README.md)。单agent持续改进Sources。

search_code过去只截行首，长行后部匹配被省略。现在唯一ripgrep解析器保留原line bytes供工具换算真实位置，公开/find完整数据形状和byte offsets保持；完整行脱敏同步映射位置，再截取首个报告命中前最多40单位的2000单位窗口，两端保留完整字符。最终窗口再次经过既有redactor，防止裁切露出新的raw-base64签名而使Tool/Source不一致。两处始终使用同一个最终snippet，原路径/行号/身份与导航保持。

真实文件测试先复现，再修复；最后32聚焦正向用例通过、最终类型8/8、正式build/renderer检查通过。零宽末尾的初始测试假设由实际JSON空submatches纠正，原失败保留；裁切二进制签名是额外真实失败并已修复。实际SDK/find四条完整结果合同通过，工具与持久化Source逐项核验。

两个独立固定600000ms运行分别254549/122549ms内自然退出，原35110/98870都join exit0，完整output/request/Host/Native/port/配对凭据闭合。合计14次真实gpt-6.1-sol流式EOF，14张Main/Side中英及最终六类输入截图亲自查看。最终特殊裁切例仅Main实测，不扩大Side资格；无UI自动化、无委托、无版本更新/发布。范围提交和正常推送后继续active单agent。
