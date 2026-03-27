# 项目说明
这是物保云产品详情页自动生成器。

## 环境
- Windows系统，所有命令必须用 powershell.exe -Command 执行
- Python已安装，在PATH中
- Playwright + Chromium已安装
- 代理：Clash端口7890

## 项目结构
- product-detail-generator/ 是主目录
- template.html 是HTML模板（Jinja2语法）
- generate.py 是生成脚本
- product_config.json 是产品配置
- output/ 是输出目录

## 使用方式
修改product_config.json后运行 python generate.py 生成详情页长图
