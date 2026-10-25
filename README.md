# ✈️ 上海 ⇄ 米兰/罗马 机票价格与平台优惠券云端监控 (GitHub Pages 版)

无需本地电脑开机，基于 **GitHub Public 仓库 + GitHub Pages + GitHub Actions** 全天候 24 小时云端托管，支持 **电脑浏览器** 与 **iOS 手机（Safari / 主屏幕独立 PWA 应用）** 随时随地查看。

## 🎯 当前监控航线
- **去程**：`04-10` 上海 (`PVG`/`SHA`) → 米兰 (`MXP`/`LIN`) 或 罗马 (`FCO`)
- **返程**：`04-24` 罗马 (`FCO`) 或 米兰 (`MXP`/`LIN`) → 上海 (`PVG`/`SHA`)
- **组合覆盖**：
  1. **米进罗出（开口程）**：4/10 上海→米兰 + 4/24 罗马→上海
  2. **罗进米出（开口程）**：4/10 上海→罗马 + 4/24 米兰→上海
  3. **米进米出（往返）**：4/10 上海→米兰 + 4/24 米兰→上海
  4. **罗进罗出（往返）**：4/10 上海→罗马 + 4/24 罗马→上海
  5. **单程拆分对比 & 自由拼单计算器**：自动对比「开口/往返联程套票」与「两段单程分开买」差价
- **刷新机制**：
  - **自动刷新（每天 2 次）**：GitHub Actions 每天北京时间 **09:00** 与 **21:00** (`cron: '0 1,13 * * *'`) 自动运行 [`scripts/update-data.js`](./scripts/update-data.js) 更新 [`public/data/latest.json`](./public/data/latest.json) 并发布到 GitHub Pages。
  - **手动刷新（随时点按）**：网页右上角配备 **「🔄 手动刷新」** 按钮，点击即可立即拉取最新云端快照并在浏览器端实时重算全部 6 大平台（携程/飞猪/去哪儿/同程/航司直营/Google比价）及优惠券到手价；同时支持一键触发云端 GitHub Action。

---

## 🚀 3 步发布到您的 GitHub Public 仓库（关机可看）

### 第 1 步：在 GitHub 创建一个 Public 仓库
1. 打开 [https://github.com/new](https://github.com/new)
2. 仓库名称填写例如：`flight-monitor`，选择 **Public（公开）**，点击 **Create repository**。

### 第 2 步：推送本项目代码到 GitHub
在项目目录打开终端（或直接双击 `deploy-to-github.bat`），运行：
```bash
git remote add origin https://github.com/<您的GitHub用户名>/flight-monitor.git
git branch -M main
git push -u origin main
```

### 第 3 步：开启 GitHub Pages（仅需设置一次）
1. 进入您的 GitHub 仓库页面 → 点击顶部 **Settings（设置）** → 左侧菜单点击 **Pages**。
2. 在 **Build and deployment** 下方的 **Source** 选择：**`GitHub Actions`**。
3. 等待约 30 秒，即可通过公开网址访问：
   - 🔗 **`https://<您的GitHub用户名>.github.io/flight-monitor/`**
   - 无论电脑是否关机，手机用 5G 流量或任意 Wi-Fi 打开该网址即可查看，在 iPhone Safari 点击「分享 → 添加到主屏幕」即可生成独立 App 图标！
