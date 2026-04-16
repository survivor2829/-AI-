FROM python:3.11-slim

# ── 0. 国内 apt 源（腾讯云）──────────────────────────────────────────
# Bookworm 用 DEB822 格式 (/etc/apt/sources.list.d/debian.sources)
# 同时兼容旧格式 (/etc/apt/sources.list)
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null; \
    sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list 2>/dev/null; true

# ── 1. 系统依赖：一次性装全，不分层 ─────────────────────────────────
# 包含：中文字体 + wget/curl + Playwright Chromium 全部运行时依赖
# 显式列出而非依赖 --with-deps 自动检测（Bookworm DEB822 下不可靠）
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    wget curl ca-certificates \
    # 中文字体
    fonts-wqy-zenhei fonts-wqy-microhei fonts-noto-cjk \
    # ── Chromium 运行时依赖（完整列表，不遗漏）──
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    # Chromium 额外需要的图形/编解码库
    libgdk-pixbuf-2.0-0 \
    libgtk-3-0 \
    libharfbuzz0b \
    libicu72 \
    libjpeg62-turbo \
    libpng16-16 \
    libwebp7 \
    libwoff1 \
    libxml2 \
    libxslt1.1 \
    libfontconfig1 \
    libfreetype6 \
    libenchant-2-2 \
    libsecret-1-0 \
    libhyphen0 \
    libmanette-0.2-0 \
    libflite1 \
    libgles2 \
    libegl1 \
    libgudev-1.0-0 \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    libgstreamer-gl1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    libevdev2 \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

# ── 2. 国内 pip 源（腾讯云）────────────────────────────────────────
RUN pip config set global.index-url https://mirrors.cloud.tencent.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.cloud.tencent.com

# ── 3. Playwright Chromium 浏览器（系统依赖已在步骤1装好）──────────
RUN pip install --no-cache-dir playwright && \
    playwright install chromium

# ── 4. Python 依赖（只有 requirements.txt 变化才重装）──────────────
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn requests

# ── 5. 预下载 rembg 模型（通过 ghfast.top 国内镜像）────────────────
# isnet-general-use 模型约 43MB，build 阶段下好避免运行时首次抠图超时
RUN mkdir -p /root/.u2net && \
    wget -q --timeout=60 --tries=3 \
      -O /root/.u2net/isnet-general-use.onnx \
      "https://ghfast.top/https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx" \
    || echo "[WARN] rembg 模型下载失败，运行时首次抠图会自动下载"

# ── 6. 复制项目文件 ────────────────────────────────────────────────
COPY . .

# ── 7. 创建运行时目录 ──────────────────────────────────────────────
RUN rm -f instance && mkdir -p static/uploads static/outputs output instance

# ── 8. 环境变量 ────────────────────────────────────────────────────
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# ── 9. 启动 ───────────────────────────────────────────────────────
# gunicorn 生产级启动，workers 默认2，可通过 WORKERS 环境变量调整
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers ${WORKERS:-2} --timeout 180 app:app
