"""Extract a declared source capsule and regenerate policy tables from raw inputs."""

from pathlib import Path
import argparse, json, os, subprocess, sys, zipfile


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(a.source) as z:
        assert all(
            not Path(n).is_absolute() and ".." not in Path(n).parts
            for n in z.namelist()
        )
        z.extractall(a.out)
    (a.out / "tmp").mkdir(exist_ok=True)
    env = dict(
        os.environ,
        PYTHONDONTWRITEBYTECODE="1",
        TEMP=str(a.out.resolve() / "tmp"),
        TMP=str(a.out.resolve() / "tmp"),
    )
    argv = [
        sys.executable,
        "-X",
        "utf8",
        "-u",
        "-B",
        str(a.out.resolve() / "solver.py"),
        "--public",
        str(a.out.resolve() / "public"),
        "--out",
        str(a.out.resolve() / "actor/tables"),
        "--certificates",
        str(a.out.resolve() / "certificates"),
    ]
    assert not (a.out / "actor/tables").exists(), (
        "source capsule must not smuggle precomputed policy"
    )
    result = subprocess.run(
        argv, env=env, capture_output=True, text=True, encoding="utf-8"
    )
    (a.out / "rebuild-process.json").write_text(
        json.dumps(
            {
                "argv": argv,
                "exit": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(result.stdout, flush=True)
    assert result.returncode == 0, result.stderr


if __name__ == "__main__":
    main()
