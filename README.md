# 宝石花园 · Gem Garden

纯前端宝石贴画小游戏。游戏源文件和单文件版统一放在 `frontend/` 目录中。

## 目录

- `frontend/index.html`：游戏页面
- `frontend/style.css`：样式
- `frontend/app.js`：游戏逻辑
- `frontend/gem-garden.html`：可直接打开的单文件版
- `frontend/README.md`：玩法与运行说明

## 本地运行

```sh
cd frontend
python3 -m http.server 8000 --bind 0.0.0.0
```

也可双击 `frontend/gem-garden.html` 打开游戏。

## GitHub Pages

继续使用 `main` 分支的根目录发布。根目录的 `index.html` 会转到 `frontend/`，原来的站点入口仍可使用。
