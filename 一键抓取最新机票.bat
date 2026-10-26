@echo off
chcp 65001 >nul
title ✈️ 携程中意直飞专线 - 真实机票实时抓取与同步
echo ============================================================
echo   ✈️ 携程中意直飞专线 (上海 ⇄ 米兰/罗马) 实时抓取启动
echo   监控日期：2027-04-10 去程 / 2027-04-24 返程
echo   抓取范围：国航 CA967/CA968、东航 MU243/MU244、东航 MU787/MU788
echo   出票模式：闭口直接抓取往返同票号打包价，开口抓取单程真实底价
echo ============================================================
echo.
echo [1/3] 正在启动 Chrome 浏览器抓取携程最新真实出票价...
node scripts/update-data.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ 抓取过程出现异常，请检查网络或 Chrome 运行状态。
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] 正在自动同步提交到 GitHub 仓库并部署 GitHub Pages...
git add data/latest.json public/data/latest.json
git diff --staged --quiet
if %ERRORLEVEL% EQU 0 (
    echo ℹ️ 票价与最新快照一致，无需重复提交。
) else (
    git commit -m "chore(data): 一键抓取最新携程直飞真实票价"
    git push origin main
    echo ✅ 已成功推送到 GitHub！GitHub Pages 网页将在 30 秒内自动更新！
)

echo.
echo ============================================================
echo [3/3] 全部完成！
echo 网页端可直接打开查看最新真实价格：
echo 🔗 https://frankwyh.github.io/flight-monitor/
echo ============================================================
echo.
pause
