# 鱼水和 AI 物业助手

面向物业服务场景的原生微信小程序 Demo。产品以 AI 对话作为主要入口，同时保留“全部服务”抽屉，让用户既可以直接说出需求，也可以按传统方式查找业务。

## 当前可体验能力

- 对话查询物业欠费
- 展示由业务层返回的结构化账单
- 二次确认并完成模拟支付
- 生成模拟电子回执
- 浏览缴费、新房交付、装修办理、搬家等一期服务入口
- 从对话页返回首页并重新开始办理

> 当前支付流程仅用于 Demo 演示，不会产生真实扣款。

仓库中的社区、房屋、用户、账单和回执均为明确标注的模拟数据，不对应任何真实主体或物业记录。

## 项目结构

```text
miniprogram/     原生微信小程序页面、组件、状态机与测试
cloudfunctions/  AI 意图理解网关（支持 OpenAI-compatible 接口）
design/          高保真页面的 HTML/CSS 与设计资源
docs/            产品流程、实现边界和验收说明
scripts/         OpenPencil 设计构建与导出脚本
```

`artifacts/` 用于存放本地生成的概念图、高保真导出图和 `.fig` 文件，不作为代码提交。

## 本地运行

1. 安装依赖：

   ```powershell
   npm install
   ```

2. 运行自动化检查：

   ```powershell
   npm run demo:test
   ```

3. 打开微信开发者工具，导入仓库根目录（包含 `project.config.json` 的目录）。如果当前账号没有配置文件中 AppID 的开发权限，请替换为自己的小程序 AppID 或测试号。

本地确定性 Demo 不依赖模型即可走通查账、确认和模拟支付主流程。

如需重新生成 OpenPencil 高保真文件，可运行：

```powershell
npm run design:build
```

## 可选模型配置

云函数 `cloudfunctions/aiGateway` 通过环境变量读取模型配置：

- `MODEL_BASE_URL`
- `MODEL_API_KEY`
- `MODEL_NAME`

模型只负责意图理解和回复措辞；房屋、账单金额、订单状态与支付结果必须来自业务层。任何密钥都不应提交到仓库。

详细说明见：

- [Demo 运行与验收](docs/Demo运行与验收说明.md)
- [产品流程与实现边界](docs/产品流程与Demo实现边界.md)
