# 《光锥之外》官网静态站点（`website/`）

独立于工作区构建链的纯静态官网目录，首页聚焦**银河系文明演化模拟**与**核心游戏特色**，完整玩法机制归档于独立的游玩说明页，并预留了登录、注册、进入游戏与应用下载入口。

## 目录结构与路由

| 路径 | 页面文件 | 说明 |
| --- | --- | --- |
| `/` | `index.html` | 官网首页：聚焦 10 万光年银河文明模拟与游戏四大核心特色 |
| `/guide/` | `guide/index.html` | **游玩说明页**：延迟星空观测演示、三种宇宙信号、离线托管与自动守护规则、光信邮戳档案与大过滤器重开 |
| `/login/` | `login/index.html` | **预留登录页**：Google / Apple / 邮箱登录入口占位 |
| `/register/` | `register/index.html` | **预留注册页**：文明名称、邮箱、出生星域选择与规则确认 |
| `/play/` | `play/index.html` | **预留进入游戏页**：在线银河网关入口占位 + Web 预览版启动器 + 浏览器兼容性自检 |
| `/download/` | `download/index.html` | **预留下载页**：iOS（App Store / TestFlight）与 Android（Google Play / APK）客户端入口及二维码占位 |
| `404.html` | `404.html` | 静态路由兜底页（支持无斜杠路径自动跳转） |

## 静态预览

```bash
python3 -m http.server 4173 --bind 127.0.0.1 -d website
```

随后访问 `http://127.0.0.1:4173/`。

## 后续 M3 / M4 真实接口对接点

可通过覆盖 `window.__STARS_ENDPOINTS__`（定义于 `assets/js/app.js`）或直接替换对应接口逻辑接入生产网关与商店链接：

- `authOidcGoogle`: `/auth/oidc/google`
- `authOidcApple`: `/auth/oidc/apple`
- `authLogin`: `/auth/login`
- `authRegister`: `/auth/register`
- `wsGateway`: 生产环境 WSS 网关地址
- `iosAppStore` / `iosTestFlight` / `androidPlay` / `androidApk`: 正式发布后的客户端下载链接
