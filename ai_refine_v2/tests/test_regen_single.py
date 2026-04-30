"""regen_single 单测.

所有 fixture 用 PIL 程序生成 + tempdir, 绝不依赖任何真实产品图.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from PIL import Image

from ai_refine_v2.regen_single import RegenResult, regenerate_screen


def _make_task_dir(tmp: Path, n_blocks: int = 12) -> Path:
    """造一个假的 v2 task_dir, 含 _planning.json + n 张 block_*.jpg + assembled.png."""
    task_dir = tmp / "v2_test_abc123"
    task_dir.mkdir()
    planning = {
        "version": "v2",
        "blocks": [
            {"block_id": f"b{i}", "visual_type": "screen",
             "prompt": f"测试 prompt {i} " * 30}
            for i in range(n_blocks)
        ],
    }
    (task_dir / "_planning.json").write_text(
        json.dumps(planning, ensure_ascii=False), encoding="utf-8"
    )
    for i in range(n_blocks):
        Image.new("RGB", (300, 400), (i * 20, 100, 200)).save(
            task_dir / f"block_{i}.jpg", quality=85
        )
    Image.new("RGB", (300, 4800), (50, 50, 50)).save(task_dir / "assembled.png")
    return task_dir


class TestRegenResultDataclass(unittest.TestCase):
    """验返回 dataclass schema 跟 spec §3.3 D4 一致."""

    def test_regen_result_fields(self):
        r = RegenResult(
            new_block_path=Path("/tmp/x.jpg"),
            new_assembled_path=Path("/tmp/y.png"),
            cost_rmb=0.7,
        )
        self.assertEqual(r.cost_rmb, 0.7)
        self.assertTrue(str(r.new_block_path).endswith(".jpg"))


if __name__ == "__main__":
    unittest.main()
