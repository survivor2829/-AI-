"""AI 精修 v2 · gpt-image-2 生图层 (W2 Day 1 骨架).

职责 (W2 完整实现后):
  1. planning JSON → 每个 block 按 visual_type 渲染 prompt (调 prompts.generator.render)
  2. 并发调 gpt-image-2 (APIMart, thinking=medium, 并发度 3)
  3. 失败策略:
     - Hero 失败 (重试 2 次仍挂) → raise HeroFailure (PRD §7 整单 fail)
     - 卖点图失败 (重试 1 次仍挂) → best-effort, 生成占位图标记 placeholder=True
  4. 成本累计 + 耗时统计

当前状态 (W2 Day 1):
  - ✅ BlockResult / GenerationResult 数据结构定义
  - ✅ HeroFailure 异常
  - ✅ generate() 函数签名 (抛 NotImplementedError, 防止误调用)
  - ⏸ APIMart HTTP 调用 (W2 Day 3)
  - ⏸ 并发 + 重试 + 占位降级 (W2 Day 4)
  - ⏸ 成本追踪 (W2 Day 5)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BlockResult:
    """单个 block 的生成结果. 无论成功失败都记录.

    Attributes:
        block_id: "hero" / "selling_point_N" / "force_vs" / "force_scenes_M" / ...
        visual_type: 对应 prompts/generator.py 的三选一
        prompt: 实际送给 gpt-image-2 的完整 prompt 字符串
        image_url: 成功时 APIMart 返回的图 URL, 失败则 None
        error: 失败原因 (API 错误 / timeout / 内容拒绝等)
        placeholder: True = 走了"best-effort 降级",图片是本地生成的占位图
                     False = 真实生成的 AI 图或真正失败 (image_url=None)
    """
    block_id: str
    visual_type: str
    prompt: str
    image_url: Optional[str] = None
    error: Optional[str] = None
    placeholder: bool = False


@dataclass
class GenerationResult:
    """一次 generate() 调用的完整结果.

    Attributes:
        blocks: 所有 block 的结果数组, 按 planning.block_order 顺序
        hero_success: Hero 是否成功生成. False → 整单 fail (PRD §7)
        total_cost_rmb: 本次累计成本 (人民币, gpt-image-2 + 可能的降级调用)
        total_elapsed_s: 端到端耗时 (秒)
        errors: 所有失败的 block_id 及原因, 供前端 debug
    """
    blocks: list[BlockResult] = field(default_factory=list)
    hero_success: bool = False
    total_cost_rmb: float = 0.0
    total_elapsed_s: float = 0.0
    errors: list[str] = field(default_factory=list)


class HeroFailure(RuntimeError):
    """Hero 屏生成失败 → PRD §7 规定整单 fail, 全额退款.

    Raises 时机: 重试 2 次后 Hero 的 gpt-image-2 调用仍挂.
    上层 (batch_processor / 新的 refine_orchestrator) 捕获后应:
      1. 标记该产品批次为 failed
      2. 不保留任何已生成的其它屏 (卖点图/强制屏), 避免"残次产品"
      3. 退款 / 通知用户
    """


def generate(
    planning: dict,
    product_cutout_url: Optional[str] = None,
    api_key: Optional[str] = None,
    thinking: str = "medium",
    concurrency: int = 3,
    max_retries_hero: int = 2,
    max_retries_sp: int = 1,
) -> GenerationResult:
    """planning JSON → 一组 gpt-image-2 图片 URL.

    Args:
        planning: ai_refine_v2.refine_planner.plan() 的返回
                  (含 product_meta / selling_points / planning 3 段)
        product_cutout_url: 产品裁图 URL (作为 image-to-image 的 Image 1).
                            None 时所有 PRESERVE 段的模板都会渲染异常.
        api_key: APIMart gpt-image-2 API key. None 时从 env GPT_IMAGE_API_KEY 读
        thinking: "off" / "low" / "medium" / "high"; W2 demo 实测 medium 性价比最好
        concurrency: 并发度, 默认 3 (APIMart 限流保护)
        max_retries_hero: Hero 失败重试次数 (PRD §7 严格, 默认 2)
        max_retries_sp: 卖点图失败重试次数 (PRD §7 best-effort, 默认 1)

    Returns:
        GenerationResult

    Raises:
        HeroFailure: Hero 重试 max_retries_hero 次后仍失败
        NotImplementedError: **W2 Day 1 骨架**, 调用会抛此异常

    TODO W2 Day 3-5:
      [W2 Day 3] 实现 APIMart HTTP 调用 + prompt 渲染
      [W2 Day 4] 加并发 (concurrent.futures.ThreadPoolExecutor)
                 + Hero/卖点图分层重试 + 占位降级
      [W2 Day 5] 成本累计 + 单测替 _http_fn 注入 mock 响应
    """
    raise NotImplementedError(
        "refine_generator.generate() 在 W2 Day 3-5 实现. "
        "当前是 W2 Day 1 骨架, 仅暴露接口."
    )
