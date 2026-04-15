FROM python:3.11-slim

# 国内 apt 源（腾讯云）
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null; \
    sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list 2>/dev/null; true

# 中文字体 + wget/curl(Playwright 的 Chromium 系统依赖交给 --with-deps 自动装)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl fonts-wqy-zenhei fonts-wqy-microhei fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 国内 pip 源（腾讯云）
RUN pip config set global.index-url https://mirrors.cloud.tencent.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.cloud.tencent.com

# Playwright Chromium + 所有系统依赖 — 放在 requirements.txt 之前!
# --with-deps 官方维护的依赖列表,会自动 apt install libxfixes3 / libnss3 /
# libatk1.0-0 / libxext6 / libatspi2.0-0 等 25+ 个 Chromium 必需库,
# 比手动维护列表稳,跟 chromium 版本同步更新
RUN pip install --no-cache-dir playwright && \
    playwright install --with-deps chromium

WORKDIR /app

# Python 依赖 — 只有 requirements.txt 变化才重装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn requests

# 复制项目文件 — 每次代码变更只影响这一层
COPY . .

# 创建运行时目录
RUN rm -f instance && mkdir -p static/uploads static/outputs output instance

# 环境变量
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# 用 gunicorn 生产级启动（Render 用 $PORT 环境变量，本地默认 5000）
# workers 默认2，支持多用户并发；可通过 WORKERS 环境变量调整
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers ${WORKERS:-2} --timeout 180 app:app
