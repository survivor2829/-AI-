# 项目说明
这是小玺AI产品详情页自动生成器，专注于**设备类**（商用清洁机器人）单一模板。

## 环境
- Windows 系统，Shell 命令使用 bash 语法（非 PowerShell）
- Python 3.x，在 PATH 中
- Playwright + Chromium 已安装（用于导出 PNG）
- 代理：Clash 端口 7890

## 项目结构
```
app.py                          主后端（Flask）
templates/
  build_form.html               产品填表页
  设备类/
    assembled.html              预览页（积木拼装）
    build_config.json           产品默认配置（blocks_hardcoded, fixed_selling_images）
  blocks/
    block_a_hero_robot_cover.html   英雄屏（场景图+产品图+卖点）
    block_b2_icon_grid.html         六大优势图标网格
    block_b3_clean_story.html       清洁故事屏
    block_e_glass_dimension.html    产品参数表（磨砂玻璃卡片）
    block_f_showcase_vs.html        1台顶8人 VS 对比屏
static/
  uploads/                      用户上传的图片
  outputs/                      Playwright 截图输出
  设备类/                        设备类固定卖点图片
```

## 工作流
1. 访问 `/build/设备类`，填写产品信息
2. 上传产品图、场景图（可选）
3. 粘贴产品文案，点"AI识别"自动填表
4. 点"生成预览"，跳转到预览页
5. 点"导出高清PNG"，Playwright 截图下载

## 启动
```bash
python app.py
```
访问 http://localhost:5000

## 关键 API
- `POST /api/upload` — 上传图片，返回 URL
- `POST /api/build/设备类/parse-text` — AI 解析文案，返回表单字段 JSON
- `POST /build/设备类` — 提交表单，渲染预览页
- `POST /export/设备类` — Playwright 截图，返回 PNG 文件
