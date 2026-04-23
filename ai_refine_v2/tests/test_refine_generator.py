"""W2 Day 1 · refine_generator 骨架桩单测.

目的: 验证 API shape 和模板渲染, **不调真实 gpt-image-2 API**.
W2 Day 3-5 实现 generate() 真功能后, 此文件会扩到端到端测.

覆盖:
  [Shape]    3 个测: 公开符号可 import, dataclass 结构, Exception 继承
  [Template] 5 个测: 3 个 visual_type 各渲染 1 次 + STYLE_BASE 追加 + 未知类型抛异常
  [Stub]     1 个测: generate() 当前应抛 NotImplementedError (保护边界)
  [Integration] 1 个测: refine_planner → render 数据流通畅 (plan 输出可喂给 render)
  合计 10 tests.
"""
from __future__ import annotations
import json
import unittest
from dataclasses import is_dataclass, fields
from pathlib import Path

from ai_refine_v2.refine_generator import (
    BlockResult,
    GenerationResult,
    HeroFailure,
    generate,
)
from ai_refine_v2.prompts.generator import (
    STYLE_BASE,
    TEMPLATES,
    PromptRenderError,
    render,
)


class TestPublicAPIShape(unittest.TestCase):
    """验证 refine_generator 公开符号 + 结构."""

    def test_imports_work(self):
        self.assertTrue(callable(generate))
        self.assertTrue(is_dataclass(BlockResult))
        self.assertTrue(is_dataclass(GenerationResult))
        self.assertTrue(issubclass(HeroFailure, RuntimeError))

    def test_block_result_fields(self):
        names = {f.name for f in fields(BlockResult)}
        self.assertEqual(
            names,
            {"block_id", "visual_type", "prompt", "image_url", "error", "placeholder"},
        )

    def test_generation_result_defaults(self):
        gr = GenerationResult()
        self.assertEqual(gr.blocks, [])
        self.assertFalse(gr.hero_success)
        self.assertEqual(gr.total_cost_rmb, 0.0)
        self.assertEqual(gr.errors, [])


class TestTemplateShape(unittest.TestCase):
    """验证 3 个 .j2 模板文件都存在, STYLE_BASE 合理."""

    def test_three_visual_types_mapped(self):
        self.assertEqual(
            set(TEMPLATES),
            {"product_in_scene", "product_closeup", "concept_visual"},
        )

    def test_all_template_files_exist(self):
        tdir = Path(__file__).resolve().parents[1] / "prompts" / "templates"
        for fname in TEMPLATES.values():
            self.assertTrue((tdir / fname).is_file(),
                            f"模板文件缺失: {fname}")

    def test_style_base_content(self):
        self.assertIn("Taobao", STYLE_BASE)
        self.assertIn("8K", STYLE_BASE)
        self.assertIn("commercial", STYLE_BASE.lower())

    def test_unknown_visual_type_raises(self):
        with self.assertRaises(PromptRenderError):
            render("hero_image", product={})


class TestPromptRendering(unittest.TestCase):
    """对 3 个 visual_type 各跑一次渲染, 断言核心字段出现."""

    def test_concept_visual_minimal_prompt(self):
        """concept_visual 是极简模板, 只需 selling_point.text."""
        prompt = render(
            "concept_visual",
            selling_point={"text": "续航 8 小时一天不充电"},
        )
        self.assertIn("续航 8 小时一天不充电", prompt)
        self.assertIn("NO text", prompt)
        self.assertIn("NO logo", prompt)
        self.assertIn("NO watermark", prompt)
        # 末尾追加 STYLE_BASE
        self.assertTrue(prompt.rstrip().endswith("commercial photography standard."),
                        f"should end with STYLE_BASE, got: {prompt[-200:]!r}")

    def test_in_scene_hero_contains_preserve(self):
        prompt = render(
            "product_in_scene",
            product={
                "name": "DZ600M 无人水面清洁机",
                "primary_color": "industrial yellow",
                "key_visual_parts": ["yellow body", "black auger floats"],
                "proportions": "compact flat float-style watercraft",
            },
            scene="modern urban riverbank at golden hour",
            hero=True,
            human_hint="engineer with tablet",
            selling_point={"text": "unused in hero"},
        )
        self.assertIn("PRESERVE", prompt)
        self.assertIn("industrial yellow", prompt)
        self.assertIn("NO color drift", prompt)
        self.assertIn("hero shot", prompt)
        self.assertIn("engineer with tablet", prompt)
        self.assertIn("cinematic golden-hour", prompt)

    def test_in_scene_non_hero_uses_selling_point(self):
        prompt = render(
            "product_in_scene",
            product={
                "name": "X", "primary_color": "red",
                "key_visual_parts": ["a"], "proportions": "b",
            },
            scene="workshop",
            hero=False,
            selling_point={"text": "specific context description"},
            human_hint="",
        )
        self.assertIn("specific context description", prompt)
        self.assertNotIn("hero shot", prompt)

    def test_closeup_contains_focus_part(self):
        prompt = render(
            "product_closeup",
            product={"name": "DZ600M", "primary_color": "industrial yellow"},
            focus_part="two black cylindrical auger floats",
        )
        self.assertIn("PRESERVE", prompt)
        self.assertIn("two black cylindrical auger floats", prompt)
        self.assertIn("macro close-up", prompt)
        self.assertIn("studio", prompt.lower())

    def test_missing_variable_raises(self):
        """StrictUndefined: 缺变量时抛 PromptRenderError (不生成空洞 prompt)."""
        with self.assertRaises(PromptRenderError):
            # product_closeup 需要 focus_part, 故意不传
            render("product_closeup",
                   product={"name": "X", "primary_color": "red"})


class TestGenerateStub(unittest.TestCase):
    """generate() 当前是骨架, 调用应抛 NotImplementedError (防止误用)."""

    def test_generate_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError) as ctx:
            generate(planning={})
        self.assertIn("W2 Day 3-5", str(ctx.exception))


class TestPlannerGeneratorIntegration(unittest.TestCase):
    """验证 refine_planner 输出 ↔ refine_generator/render 输入的数据流通畅.

    取一个历史黄金样本, 用它的 planning 数据直接喂给 render, 应能生成合法 prompt.
    """

    def test_golden_sample_flows_into_render(self):
        repo_root = Path(__file__).resolve().parents[2]
        sample_path = repo_root / "docs" / "PRD_AI_refine_v2" / "w1_samples" / "10_device_dz600m.json"
        if not sample_path.is_file():
            self.skipTest("DZ600M 黄金样本不在, 跳过")

        data = json.loads(sample_path.read_text(encoding="utf-8"))
        po = data["planner_output"]
        pm = po["product_meta"]
        # 取一个 product_closeup 卖点做特写
        sp_closeup = next(
            (sp for sp in po["selling_points"] if sp["visual_type"] == "product_closeup"),
            None,
        )
        self.assertIsNotNone(sp_closeup, "黄金样本应至少有一个 closeup 卖点")

        # 渲染 closeup
        closeup_prompt = render(
            "product_closeup",
            product={"name": pm["name"], "primary_color": pm["primary_color"]},
            focus_part=sp_closeup["text"],  # 中文特写描述
        )
        self.assertIn(pm["primary_color"], closeup_prompt)
        self.assertIn(sp_closeup["text"], closeup_prompt)

        # 渲染 concept (若有)
        sp_concept = next(
            (sp for sp in po["selling_points"] if sp["visual_type"] == "concept_visual"),
            None,
        )
        if sp_concept:
            concept_prompt = render("concept_visual", selling_point=sp_concept)
            self.assertIn(sp_concept["text"], concept_prompt)


if __name__ == "__main__":
    unittest.main()
