from __future__ import annotations

import asyncio
import os
from pathlib import Path
from types import SimpleNamespace

from workbuddy_bench.judge.runtime import harbor as harbor_runtime


def test_transformed_verifier_is_uploaded_readable_by_the_dev_user(tmp_path: Path) -> None:
    tests = tmp_path / "tests"
    tests.mkdir()
    verifier = tests / "verifier.py"
    verifier.write_text("print('original')\n")

    class Environment:
        def __init__(self) -> None:
            self.capabilities = SimpleNamespace(mounted=True)
            self.uploaded_mode: int | None = None
            self.uploaded_content: str | None = None
            self.uploaded_target: str | None = None
            self.downloaded: tuple[str, Path] | None = None

        async def upload_dir(self, source_dir: Path, target_dir: str) -> None:
            assert source_dir == tests
            assert target_dir == "/tests"

        async def upload_file(self, source_path: Path, target_path: str) -> None:
            self.uploaded_mode = os.stat(source_path).st_mode & 0o777
            self.uploaded_content = Path(source_path).read_text()
            self.uploaded_target = target_path

        async def download_dir(self, source_dir: str, target_dir: Path) -> None:
            self.downloaded = (source_dir, Path(target_dir))

    environment = Environment()
    runtime = object.__new__(harbor_runtime.HarborAttemptRuntime)
    runtime.environment = environment
    runtime.tests_dir = "/tests"
    runtime.container_verifier_dir = "/logs/verifier"
    runtime.host_verifier_dir = tmp_path / "host-verifier"
    runtime.verifier = SimpleNamespace(
        task=SimpleNamespace(paths=SimpleNamespace(tests_dir=tests))
    )
    original_transform = harbor_runtime.transform_verifier_file
    harbor_runtime.transform_verifier_file = lambda _path: "print('transformed')\n"
    try:
        asyncio.run(runtime.upload_tests())
        asyncio.run(runtime.download_verifier_dir())
    finally:
        harbor_runtime.transform_verifier_file = original_transform

    assert environment.uploaded_mode == 0o644
    assert environment.uploaded_content == "print('transformed')\n"
    assert environment.uploaded_target == "/tests/verifier.py"
    assert environment.downloaded == ("/logs/verifier", tmp_path / "host-verifier")
