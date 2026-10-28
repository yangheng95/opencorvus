# 证据记录格式

以下为格式示例，所有占位值必须由真实执行记录替换。不是已经发生的实验或已签署的复跑。

```json
{
  "run_id": "H01-systemA-seed1-attempt1",
  "case": "H01",
  "version": "0.1.0-dev",
  "system": "actual configuration identity",
  "model": "actual requested and observed model identity",
  "tool_profile": "frozen tools and tool versions",
  "environment": "OS/image/runtime/CPU/memory/network identity",
  "input_revision": "actual Git commit and exported case identity",
  "budget": {"total_model_tokens": 1000000, "cpu_seconds": 7200, "memory_gib": 16, "disk_gib": 5, "inactivity_seconds": 600, "external_model_calls": 0},
  "started_at": "2026-10-29T00:00:00Z",
  "ended_at": "2026-10-29T01:00:00Z",
  "disposition": "completed",
  "provider_cost": null,
  "replay": {
    "status": "verified",
    "reviewer": "actual independent replay reviewer",
    "evidence": [{"path": "verification/clean-replay.log", "locator": "command and exit status lines", "observation": "actual observed result"}]
  }
}
```

双评各一份。marks必须包含对应case全部16个R叶。0/1/2为原始评分，rationale必须解释该叶的锚点；path相对封存产物目录，locator定位页/行/表/实验；目录存在、模型自述或与该叶无关的记录都不是正向证据。

```json
{
  "reviewer": "independent reviewer identity",
  "blind": true,
  "independent": true,
  "case": "H01",
  "version": "0.1.0-dev",
  "run_id": "H01-systemA-seed1-attempt1",
  "marks": [{
    "leaf": "H01-R01",
    "rating": 2,
    "rationale": "observed estimand meets the exact full-credit anchor",
    "evidence": [{"path": "paper.md", "locator": "Methods, estimand paragraph", "observation": "quote or precise paraphrase of actual observation"}]
  }]
}
```

示例省略其余15叶，因此不能直接提交评分。盲态与独立性来自真实流程，填true本身不能证明流程成立。运行设施错误、取消和完整性事件不应为了凑齐评分而补造review。
