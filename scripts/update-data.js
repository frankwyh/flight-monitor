/**
 * GitHub Actions 云端定时更新脚本 (每天早晚 2 次自动运行 + 支持手动触发)
 * 生成静态数据文件 public/data/latest.json 供 GitHub Pages 免后端加载
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { fetchAllMonitoredFlights } = require('../src/scraper');
const { loadState, saveState, recordSnapshotToHistory } = require('../src/storage');
const { PLATFORMS } = require('../src/coupons');

const PUBLIC_DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const LATEST_JSON_PATH = path.join(PUBLIC_DATA_DIR, 'latest.json');

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

  fs.writeFileSync(LATEST_JSON_PATH, JSON.stringify(staticPayload, null, 2), 'utf8');
  console.log(`✅ 静态数据已写入: ${LATEST_JSON_PATH}`);

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
