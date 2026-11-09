from pathlib import Path
import json, os
root = (Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b63").resolve()
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))["after"]
relative = ".opencorvus/mission-skills/broken-demo/SKILL.md"
fixture = (Path(seed["directory"]) / relative).resolve()
assert fixture.is_relative_to(root / "project-after")
original = seed["files"][relative].encode("utf-8")
assert fixture.read_bytes() == original
fixture.write_bytes(original.replace(b"---\n", b"---\nname: repaired-demo\n", 1))
print(f"Repaired own fixture: {relative}")
