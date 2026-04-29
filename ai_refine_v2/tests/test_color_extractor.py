"""color_extractor 单测.

所有 fixture 用 PIL 程序生成, 绝不依赖任何真实产品图 (避免硬编码具体产品).
"""
from __future__ import annotations

import io
import unittest
from pathlib import Path

from PIL import Image

from ai_refine_v2.color_extractor import ColorAnchor, extract_color_anchor


def _make_solid_png(rgb: tuple[int, int, int], size: int = 100, alpha: bool = False) -> bytes:
    """生成纯色 PNG bytes (in-memory). alpha=True 加 alpha=255."""
    mode = "RGBA" if alpha else "RGB"
    color = (*rgb, 255) if alpha else rgb
    img = Image.new(mode, (size, size), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestColorAnchorDataclass(unittest.TestCase):
    """验 ColorAnchor dataclass 的 schema 跟 spec §4.1 一致."""

    def test_color_anchor_fields(self):
        anchor = ColorAnchor(
            primary_hex="#FF0000",
            palette_hex=["#FF0000", "#00FF00", "#0000FF"],
            confidence=0.85,
            swatch_png_bytes=b"\x89PNG\r\n\x1a\n",
        )
        self.assertEqual(anchor.primary_hex, "#FF0000")
        self.assertEqual(len(anchor.palette_hex), 3)
        self.assertAlmostEqual(anchor.confidence, 0.85)
        self.assertTrue(anchor.swatch_png_bytes.startswith(b"\x89PNG"))


class TestBackgroundFilter(unittest.TestCase):
    """验非背景像素过滤. PNG alpha + JPG 白底两条路径."""

    def test_fully_transparent_png_returns_none(self):
        """完全透明的 PNG → 无非背景像素 → None (不应崩)."""
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as td:
            p = Path(td) / "fully_transparent.png"
            img = Image.new("RGBA", (100, 100), (255, 0, 0, 0))  # 红色 + alpha=0
            img.save(p, format="PNG")
            anchor = extract_color_anchor(p)
            self.assertIsNone(anchor, "全透明 PNG 应返 None, 不应识别红色")

    def test_pure_white_jpg_returns_none(self):
        """纯白 JPG → 全是背景 → None."""
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as td:
            p = Path(td) / "pure_white.jpg"
            img = Image.new("RGB", (100, 100), (255, 255, 255))
            img.save(p, format="JPEG", quality=90)
            anchor = extract_color_anchor(p)
            self.assertIsNone(anchor, "纯白 JPG 应返 None (产品像素被全部当背景滤掉)")


class TestPrimaryColorExtraction(unittest.TestCase):
    """验 quantize 主色 + palette + confidence."""

    def _save_solid(self, td: Path, name: str, rgb: tuple[int, int, int]) -> Path:
        p = td / name
        img = Image.new("RGBA", (200, 200), (*rgb, 255))
        img.save(p, format="PNG")
        return p

    def _hex_distance(self, hex1: str, hex2: str) -> float:
        """欧式距离, 单位 0-255 通道."""
        r1, g1, b1 = int(hex1[1:3], 16), int(hex1[3:5], 16), int(hex1[5:7], 16)
        r2, g2, b2 = int(hex2[1:3], 16), int(hex2[3:5], 16), int(hex2[5:7], 16)
        return ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) ** 0.5

    def test_solid_red_primary_extracted(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as td:
            p = self._save_solid(Path(td), "red.png", (255, 0, 0))
            anchor = extract_color_anchor(p)
            self.assertIsNotNone(anchor, "纯红 cutout 应能算出主色")
            dist = self._hex_distance(anchor.primary_hex, "#FF0000")
            self.assertLess(dist, 10, f"primary_hex {anchor.primary_hex} 偏离 #FF0000 太远 (dist={dist:.1f})")

    def test_solid_red_palette_size(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as td:
            p = self._save_solid(Path(td), "red.png", (255, 0, 0))
            anchor = extract_color_anchor(p)
            self.assertIsNotNone(anchor)
            self.assertEqual(len(anchor.palette_hex), 3, "palette 必须 top-3")
            self.assertEqual(anchor.palette_hex[0], anchor.primary_hex,
                             "palette[0] 必须等于 primary_hex")

    def test_solid_red_confidence_high(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as td:
            p = self._save_solid(Path(td), "red.png", (255, 0, 0))
            anchor = extract_color_anchor(p)
            self.assertIsNotNone(anchor)
            self.assertGreater(anchor.confidence, 0.95,
                               f"纯色产品 confidence 应近 1.0, 实际 {anchor.confidence:.3f}")


if __name__ == "__main__":
    unittest.main()
