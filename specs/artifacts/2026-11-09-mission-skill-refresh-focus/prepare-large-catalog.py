from pathlib import Path
import os
root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b64"
stage = root / "large-profile-skill-directory"
stage.mkdir()
for index in range(1600):
    name = f"pending-window-{index:04d}"
    target = stage / name / "SKILL.md"
    target.parent.mkdir()
    target.write_bytes(f"---\nname: {name}\ndescription: A local catalog timing definition {index}.\n---\n# Local review\n".encode("utf-8"))
print("Prepared 1600 owned, valid skill definitions.")
