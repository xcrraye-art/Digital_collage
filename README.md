# 宝石花园 · Gem Garden

纯前端宝石贴画小游戏。打开后选择贴画，进入白色画布，按照编号贴放写实切面宝石。手机支持点击、拖动连贴和双指缩放。

## 目录

- `frontend/index.html`：游戏页面
- `frontend/style.css`：样式
- `frontend/app.js`：游戏逻辑和四幅贴画
- `frontend/assets/`：本地写实宝石图集及来源说明
- `frontend/gem-garden.html`：含素材的单文件版，可直接打开
- `frontend/README.md`：玩法、开发与测试说明
- `scripts/bundle.py`：生成单文件版
- `tests/smoke.cjs`：浏览器功能与触摸回归检查

## 本地运行

```sh
cd frontend
python3 -m http.server 8000 --bind 0.0.0.0
```

无需安装运行依赖或构建，也可双击 `frontend/gem-garden.html` 打开游戏。存档在当前设备浏览器中，不会跨设备同步。

修改前端后在仓库根目录运行 `python3 scripts/bundle.py` 同步单文件版。

## GitHub Pages

使用 `main` 分支的根目录发布。根目录 `index.html` 会转到 `frontend/`，原来的站点入口仍可使用。
