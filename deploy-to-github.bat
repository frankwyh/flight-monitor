@echo off
chcp 65001 >nul
title 一键发布到 GitHub Public (GitHub Pages 云端监控)
cd /d "%~dp0"

echo ============================================================
echo ✈️  上海 ⇄ 米兰/罗马 机票监控 — 发布到 GitHub Public 仓库
echo ============================================================
echo.
echo 1. 请先在 https://github.com/new 创建一个 Public 公开仓库 (如 flight-monitor)
echo 2. 在下方粘贴您的仓库地址 (例如 https://github.com/您的用户名/flight-monitor.git)
echo.
set /p REPO_URL="请输入您的 GitHub 仓库地址: "

if "%REPO_URL%"=="" (
  echo 未输入仓库地址，已取消。
  pause
  exit /b
)

node scripts/update-data.js
git add -A
git commit -m "feat: 初始化中意机票价格与神券云端监控 (每天2次自动刷新+手动刷新)" 2>nul
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo.
echo 正在推送到 GitHub...
git push -u origin main

echo.
echo ============================================================
echo ✅ 推送完成！
echo 最后一步：请打开 GitHub 仓库的 Settings -^> Pages，
echo 将 Source (构建来源) 改为 【GitHub Actions】，即可通过公开网址 24 小时关机查看！
echo ============================================================
pause
