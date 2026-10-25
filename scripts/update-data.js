/**
 * GitHub Actions 云端定时更新脚本 (每天早晚 2 次自动运行 + 支持手动触发)
 * 生成静态数据文件 public/data/latest.json 及同步根目录 data/latest.json，兼容所有 GitHub Pages 模式
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { fetchAllMonitoredFlights } = require('../src/scraper');
const { loadState, saveState, recordSnapshotToHistory } = require('../src/storage');
const { PLATFORMS } = require('../src/coupons');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, 'data');
const ROOT_DATA_DIR = path.join(ROOT_DIR, 'data');
const LATEST_JSON_PATH = path.join(PUBLIC_DATA_DIR, 'latest.json');
const ROOT_LATEST_JSON_PATH = path.join(ROOT_DATA_DIR, 'latest.json');

function sendBarkNotification(barkUrl, title, body) {
  return new Promise(resolve => {
    if (!barkUrl) return resolve(false);
    try {
      const cleanBase = barkUrl.replace(/\/+$/, '');
      const fullUrl = `${cleanBase}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=${encodeURIComponent('中意机票监控')}&sound=calypso`;
      const client = fullUrl.startsWith('https') ? https : http;
      const req = client.get(fullUrl, { timeout: 5000 }, res => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function runUpdate() {
  console.log('🚀 [GitHub Actions] 开始执行机票价格与平台神券巡检 (每天2次定时/手动触发)...');
  const state = loadState();

  const snapshot = await fetchAllMonitoredFlights({
    outboundDate: state.settings.outboundDate || '2027-04-10',
    inboundDate: state.settings.inboundDate || '2027-04-24',
    coupons: state.coupons
  });

  recordSnapshotToHistory(state, snapshot);
  saveState(state);

  if (!fs.existsSync(PUBLIC_DATA_DIR)) {
    fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOT_DATA_DIR)) {
    fs.mkdirSync(ROOT_DATA_DIR, { recursive: true });
  }

  const staticPayload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    scheduleInfo: '每天 09:00 / 21:00 (北京时间) 自动刷新 2 次 + 支持页面手动刷新',
    settings: state.settings,
    coupons: state.coupons,
    platforms: PLATFORMS,
    priceHistory: state.priceHistory,
    favorites: state.favorites || [],
    snapshot
  };

  const jsonStr = JSON.stringify(staticPayload, null, 2);
  fs.writeFileSync(LATEST_JSON_PATH, jsonStr, 'utf8');
  fs.writeFileSync(ROOT_LATEST_JSON_PATH, jsonStr, 'utf8');

  // 同步静态前端文件到仓库根目录，使 GitHub Pages 无论选 "GitHub Actions" 还是 "Deploy from a branch (main / root)" 都能直接访问
  const staticFiles = ['index.html', 'styles.css', 'app.js', 'manifest.json', 'sw.js', 'icon.svg'];
  for (const file of staticFiles) {
    const srcFile = path.join(PUBLIC_DIR, file);
    const destFile = path.join(ROOT_DIR, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // 同步通用版目录 public/universal 到根目录 universal
  const publicUniDir = path.join(PUBLIC_DIR, 'universal');
  const rootUniDir = path.join(ROOT_DIR, 'universal');
  if (fs.existsSync(publicUniDir)) {
    if (!fs.existsSync(rootUniDir)) {
      fs.mkdirSync(rootUniDir, { recursive: true });
    }
    const uniFiles = fs.readdirSync(publicUniDir);
    for (const uFile of uniFiles) {
      fs.copyFileSync(path.join(publicUniDir, uFile), path.join(rootUniDir, uFile));
    }
  }

  console.log(`✅ 静态数据已写入: ${LATEST_JSON_PATH} 并同步至根目录`);

  // 如果环境变量配置了 BARK_PUSH_URL，发送巡检简报到 iOS
  const barkUrl = process.env.BARK_PUSH_URL || state.settings.barkPushUrl;
  const bestFlight = snapshot.allComboFlights && snapshot.allComboFlights[0];
  if (barkUrl && bestFlight) {
    const title = '✈️ 4/10-4/24 意大利机票定时巡检';
    const body = `最低实付 ¥${bestFlight.finalNetPrice} [${bestFlight.shortLabel} · ${bestFlight.airlineDisplay} · ${bestFlight.bestPlatform.shortName}]`;
    const pushed = await sendBarkNotification(barkUrl, title, body);
    console.log(`📲 iOS Bark 推送结果: ${pushed ? '成功' : '跳过/未送达'}`);
  }
}

runUpdate().catch(err => {
  console.error('❌ 更新任务失败:', err);
  process.exit(1);
});
