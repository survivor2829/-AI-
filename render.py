"""
产品详情页自动生成工具
用法: python generate.py [config.json] [--scale 1|2]
"""
import re
import json
import sys
import os
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path
from jinja2 import Template
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
UPLOAD_DIR = BASE_DIR / "uploads"
TEMPLATES_DIR = BASE_DIR / "templates"

# 第2、4屏固定图片默认路径（config 未填且模板目录无匹配时使用）
DEFAULT_SCREEN2 = r"C:\Users\28293\Desktop\demo\扫地车\详情\DW2000B-Plus新扫地车详情页-260312_02.jpg"
DEFAULT_SCREEN4 = r"C:\Users\28293\Desktop\demo\扫地车\详情\DW2000B-Plus新扫地车详情页-260312_04.jpg"


def resolve_template_image(product_type: str, screen_name: str) -> str:
    """
    在 templates/{product_type}/ 下查找固定屏图片。
    支持 .jpg / .jpeg / .png 三种扩展名。
    找到返回完整路径字符串，找不到返回空字符串。
    """
    if not product_type:
        return ""
    for ext in ("jpg", "jpeg", "png"):
        candidate = TEMPLATES_DIR / product_type / f"{screen_name}.{ext}"
        if candidate.exists():
            return str(candidate)
    return ""


def normalize_config(cfg: dict) -> dict:
    """
    将新格式 config 标准化为 template.html 所需格式。
    支持新旧两种格式并存，缺失字段给默认值。
    """
    # ── slogan：单字符串 → slogan_line1 + slogan_line2 ──────────
    if "slogan_line1" not in cfg:
        slogan = cfg.get("slogan", "")
        # 按标点切割（逗号或句号），最多拆成两行
        parts = re.split(r'[，,。]', slogan, maxsplit=1)
        cfg["slogan_line1"] = (parts[0] + "，").strip() if len(parts) > 1 else slogan
        cfg["slogan_line2"] = parts[1].strip() if len(parts) > 1 else ""

    # ── core_params：dict → list of {label, value} ──────────────
    if isinstance(cfg.get("core_params"), dict):
        cfg["core_params"] = [
            {"label": k, "value": v}
            for k, v in list(cfg["core_params"].items())[:4]
        ]
    cfg["core_params_list"] = [
        (item["label"], item["value"])
        for item in (cfg.get("core_params") or [])
        if isinstance(item, dict)
    ]

    # ── detail_params：dict → list of [名1,值1,名2,值2] ─────────
    if isinstance(cfg.get("detail_params"), dict):
        items = list(cfg["detail_params"].items())
        rows = []
        for i in range(0, len(items), 2):
            k1, v1 = items[i]
            if i + 1 < len(items):
                k2, v2 = items[i + 1]
            else:
                k2, v2 = "", ""
            rows.append([k1, v1, k2, v2])
        cfg["detail_params"] = rows

    # ── 缺失字段给默认值 ─────────────────────────────────────────
    model = cfg.get("model", "")
    cfg.setdefault("machine_name", cfg.get("product_name", "扫地车"))
    cfg.setdefault("machine_pros", ["省时省钱省心"])
    cfg.setdefault("human_cons",   ["人工效率低", "成本高"])
    cfg.setdefault("params_subtitle", f"{model}全新升级")
    cfg.setdefault("efficiency_value", cfg.get("efficiency_claim", ""))
    cfg.setdefault("people_count", "3")
    cfg.setdefault("machine_stats", [
        cfg.get("efficiency_claim", ""),
        f"一年劲省{cfg.get('savings_claim', '')}",
    ])

    return cfg


def ensure_nobg(path_str: str) -> str:
    """
    确保产品图是透明底 PNG：
    1. output/<stem>_nobg.png 已存在 → 直接复用缓存
    2. 图片已有真实透明像素（alpha.min < 250）→ 直接使用原图
    3. 否则调用 rembg 抠图，结果保存到 output/<stem>_nobg.png
    """
    if not path_str:
        return path_str
    p = Path(path_str)
    if not p.exists():
        return path_str

    nobg = OUTPUT_DIR / f"{p.stem}_nobg.png"  # 统一保存到 output/ 目录

    # 已有缓存直接用
    if nobg.exists():
        print(f"[抠图] 使用缓存: {nobg.name}")
        return str(nobg)

    # 检查是否真正有透明像素（RGBA 但全白底的图不算透明）
    try:
        from PIL import Image as _Img
        import numpy as np
        with _Img.open(p) as im:
            if im.mode == "RGBA":
                alpha = np.array(im)[:, :, 3]
                if alpha.min() < 250:          # 存在真实透明区域
                    print(f"[抠图] 已有透明底，跳过: {p.name}")
                    return path_str
    except Exception:
        pass

    # 调用 rembg 抠图
    try:
        from rembg import remove as rembg_remove
    except ImportError:
        print("[抠图] rembg 未安装，正在安装...")
        import subprocess
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "rembg", "onnxruntime"],
            check=True, capture_output=True
        )
        from rembg import remove as rembg_remove

    print(f"[抠图] 正在去除背景: {p.name} ...")
    with open(p, "rb") as f:
        result = rembg_remove(f.read())
    nobg.write_bytes(result)
    print(f"[抠图] 已保存透明底: {nobg.name}")
    return str(nobg)


def path_to_url(path_str: str) -> str:
    """将 Windows 文件路径转换为 file:// URL（处理中文路径）"""
    if not path_str:
        return ""
    p = Path(path_str)
    if not p.exists():
        print(f"[警告] 图片文件不存在: {path_str}")
    return p.as_uri()


def _make_img_url(path_str: str, base_url: str = None) -> str:
    """
    将本地路径转成可访问的 URL：
    - 有 base_url（web app 调用）：uploads/ 和 output/ 用 HTTP URL，
      templates/ 用 /api/template-thumb/ 接口，其余 fallback file://
    - 无 base_url（CLI 调用）：直接 file://
    """
    if not path_str:
        return ""
    p = Path(path_str)
    if not base_url:
        return path_to_url(path_str)

    try:
        rel = p.relative_to(UPLOAD_DIR)
        return f"{base_url}/api/uploads/{rel.as_posix()}"
    except ValueError:
        pass
    try:
        rel = p.relative_to(OUTPUT_DIR)
        return f"{base_url}/api/output/{rel.as_posix()}"
    except ValueError:
        pass
    try:
        rel = p.relative_to(TEMPLATES_DIR)
        parts = rel.parts
        if len(parts) >= 2:
            return f"{base_url}/api/template-thumb/{parts[0]}/{'/'.join(parts[1:])}"
    except ValueError:
        pass
    # 其他路径（Desktop 等）仍用 file://
    return path_to_url(path_str)


def _resolve_image_urls(config: dict, base_url: str = None) -> dict:
    """将配置中的图片路径转换为可访问 URL，并处理抠图和模板匹配逻辑。"""
    url = lambda p: _make_img_url(p, base_url)

    product_img = ensure_nobg(config.get("product_image", ""))
    config["product_image_url"] = url(product_img)

    if config.get("scene_image"):
        config["scene_image_url"] = url(config["scene_image"])
    else:
        config["scene_image_url"] = url(product_img)

    product_type = config.get("product_type", "")
    tpl_type = config.get("template_type", "") or product_type

    s2 = resolve_template_image(tpl_type, "screen2")
    if s2:
        config["screen2_image_url"] = url(s2)
        print(f"[模板] 第2屏使用模板: templates/{tpl_type}/screen2")
    elif config.get("screen2_image"):
        config["screen2_image_url"] = url(config["screen2_image"])
    else:
        pt_hint = f"templates/{tpl_type}/" if tpl_type else "templates/<product_type>/"
        print(f"[警告] 未找到 {pt_hint}screen2.jpg，使用默认图片")
        config["screen2_image_url"] = url(DEFAULT_SCREEN2)

    s4 = resolve_template_image(tpl_type, "screen4")
    if s4:
        config["screen4_image_url"] = url(s4)
        print(f"[模板] 第4屏使用模板: templates/{tpl_type}/screen4")
    elif config.get("screen4_image"):
        config["screen4_image_url"] = url(config["screen4_image"])
    else:
        pt_hint = f"templates/{tpl_type}/" if tpl_type else "templates/<product_type>/"
        print(f"[警告] 未找到 {pt_hint}screen4.jpg，使用默认图片")
        config["screen4_image_url"] = url(DEFAULT_SCREEN4)

    return config


def _render_and_screenshot(config: dict, scale: int) -> str:
    """渲染 Jinja2 模板并用 Playwright 截图，返回输出 PNG 路径。"""
    # 优先使用 templates/{template_type}/template.html，其次用默认
    tpl_type = config.get("template_type", "") or config.get("product_type", "")
    custom_tpl = TEMPLATES_DIR / tpl_type / "template.html" if tpl_type else None
    if custom_tpl and custom_tpl.exists():
        template_file = custom_tpl
        print(f"[模板] 使用自定义HTML模板: templates/{tpl_type}/template.html")
    else:
        template_file = BASE_DIR / "template.html"
        print(f"[模板] 使用默认HTML模板: template.html")
    with open(template_file, "r", encoding="utf-8") as f:
        tpl = Template(f.read())

    import sys as _sys
    _enc = _sys.stdout.encoding or "utf-8"
    print(f"[RENDER DEBUG] core_params_list={config.get('core_params_list')}".encode(_enc, errors="replace").decode(_enc))
    print(f"[RENDER DEBUG] savings_claim={config.get('savings_claim')}".encode(_enc, errors="replace").decode(_enc))
    print(f"[RENDER DEBUG] dimensions={config.get('dimensions')}".encode(_enc, errors="replace").decode(_enc))
    html = tpl.render(**config)

    temp_html = OUTPUT_DIR / "_temp_preview.html"
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[OK] HTML 已生成: {temp_html}")

    model_slug = config.get("model", "product").replace(" ", "_").replace("/", "-")
    out_png = OUTPUT_DIR / f"{model_slug}_detail.png"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            args=["--disable-web-security", "--allow-file-access-from-files"]
        )
        ctx = browser.new_context(
            viewport={"width": 750, "height": 900},
            device_scale_factor=scale,
        )
        page = ctx.new_page()
        page.goto(temp_html.as_uri(), wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(800)
        page.screenshot(path=str(out_png), full_page=True)
        browser.close()

    print(f"[完成] 图片已生成: {out_png}")
    print(f"       宽度: {750 * scale}px (高清{scale}x)")
    return str(out_png)


def generate_detail_page(config: dict, scale: int = 2, base_url: str = None) -> str:
    """
    接收配置字典，生成详情页图片。可被外部模块直接导入调用。

    Args:
        config:   产品配置字典（与 product_config.json 格式相同）
        scale:    像素密度（1=750px, 2=1500px 高清）
        base_url: web app 调用时传入 "http://127.0.0.1:5000"，
                  使图片通过 HTTP 加载，避免 Playwright file:// 安全限制

    Returns:
        输出 PNG 文件的绝对路径
    """
    config = normalize_config(config)
    print(f"[DEBUG] core_params_list={config.get('core_params_list')}")
    print(f"[DEBUG] efficiency_value={config.get('efficiency_value')}")
    print(f"[DEBUG] people_count={config.get('people_count')}")
    config = _resolve_image_urls(config, base_url=base_url)
    return _render_and_screenshot(config, scale)


def render_page(config_path: str = None, scale: int = 2) -> str:
    """
    读取 JSON 配置文件，生成详情页图片（CLI 入口）。

    Args:
        config_path: JSON 配置文件路径（默认使用同目录的 product_config.json）
        scale: 像素密度（1=750px宽, 2=1500px宽高清）

    Returns:
        输出 PNG 文件路径
    """
    config_path = Path(config_path) if config_path else BASE_DIR / "product_config.json"
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    return generate_detail_page(config, scale=scale)


def open_result(path: str):
    """在系统默认程序中打开输出文件（Windows）"""
    os.startfile(path)


if __name__ == "__main__":
    # 解析命令行参数
    cfg = None
    scale = 2

    args = sys.argv[1:]
    skip_next = False
    for i, arg in enumerate(args):
        if skip_next:
            skip_next = False
            continue
        if arg == "--scale" and i + 1 < len(args):
            scale = int(args[i + 1])
            skip_next = True
        elif not arg.startswith("--"):
            cfg = arg

    print("=" * 50)
    print("  产品详情页生成工具 v1.0")
    print("=" * 50)

    out = render_page(cfg, scale=scale)

    # 自动打开预览
    print(f"\n正在打开预览图...")
    open_result(out)
