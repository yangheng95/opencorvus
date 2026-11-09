from pathlib import Path
import json, os, shutil, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b64"
previous = root.parent / "opencorvus-iteration-20261109-b62"
root.mkdir(exist_ok=True)
shutil.copy2(previous / "fixture.gitconfig", root / "fixture.gitconfig")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
sample = json.loads((previous / "seed.json").read_text(encoding="utf-8"))["before"]["skill"]
files = {"notes.txt": "Mission Skill toolbar focus fixture. Original file.\n", ".opencorvus/mission-skills/inspection-demo/SKILL.md": sample}
for index in range(320):
    name = f"review-fixture-{index:03d}"
    files[f".opencorvus/mission-skills/{name}/SKILL.md"] = f"---\nname: {name}\ndescription: Local review definition {index}.\n---\n# Review\n\nCatalog read evidence.\n"
projects = {}
for phase in ["before", "after"]:
    directory = root / f"project-{phase}"
    for rel, contents in files.items():
        target = directory / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(contents.encode("utf-8"))
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    git("init", "-q")
    git("add", "notes.txt", ".opencorvus/mission-skills")
    git("commit", "-qm", "Seed real local Mission Skill refresh fixture")
    projects[phase] = {"directory": str(directory), "head": git("rev-parse", "HEAD").decode().strip()}
(root / "seed.json").write_text(json.dumps({"projects": projects, "fileCount": len(files), "additionalSkillCount": 320}, indent=2) + "\n", encoding="utf-8")
print(f"Seeded {len(files)} original files in each isolated Git project.")
