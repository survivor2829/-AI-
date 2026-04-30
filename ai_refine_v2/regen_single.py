"""单屏重生成模块 (v3.3 reroll).

职责: 已完成的 v2 task 内, 重新生成第 N 屏, 重拼长图.
纯函数, 无 Flask / DB 依赖. 调用方 (app.py 端点) 负责权限/锁/WS.

Spec: docs/superpowers/specs/2026-04-30-regenerate-screen-design.md
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class RegenResult:
    """单屏重生成结果. spec §3.3 D4."""

    new_block_path: Path
    new_assembled_path: Path
    cost_rmb: float


def regenerate_screen(
    task_dir: Path,
    block_index: int,
    cutout_path: Optional[Path],
    deepseek_key: str,
    gpt_image_key: str,
) -> RegenResult:
    """重生第 block_index 屏, 重拼长图.

    raises:
        FileNotFoundError: task_dir / _planning.json / block_<idx>.jpg 缺
        IndexError: block_index 越界
        RuntimeError: gpt-image-2 调用失败 (透传 _generate_one_block_v2 错)
    """
    raise NotImplementedError("Task 2 实现")
