/**
 * 机票价格与优惠券智能监控服务器
 * 同时支持：电脑端浏览器大屏看板 + iOS 手机端 Safari / 主屏幕 PWA 应用
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fetchAllMonitoredFlights } = require('./src/scraper');
const { loadState, saveState, recordSnapshotToHistory } = require('./src/storage');
const { PLATFORMS } = require('./src/coupons');

const PORT = process.env.PORT || 3080;
const PUBLIC_DIR = path.join(__dirname, 'public');

let appState = loadState();
let latestSnapshot = null;

/**
 * 获取本机局域网 IPv4 地址（排除虚拟网卡 198.18.x.x 等），用于生成手机扫码访问地址
 */
function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('198.18.') || net.address.startsWith('169.254.')) continue;
        candidates.push({ name, address: net.address });
      }
    }
  }
  const preferred = candidates.find(c => c.address.startsWith('192.168.') || c.address.startsWith('10.'));
  return preferred ? preferred.address : candidates[0] ? candidates[0].address : '127.0.0.1';
}

/**
 * 触发一次全航线抓取与优惠券重算
 */
async function refreshFlightData(recordHistory = true) {
  console.log('🔄 [本地服务] 触发全网机票与 GDS 实时真刷新抓取...');
  latestSnapshot = await fetchAllMonitoredFlights({
    outboundDate: appState.settings.outboundDate,
    inboundDate: appState.settings.inboundDate,
    coupons: appState.coupons
  });

  if (recordHistory) {
    recordSnapshotToHistory(appState, latestSnapshot);
  }
  saveState(appState);

  // 同步写入持久化静态文件供静态网页与 GitHub Pages 使用
  try {
    const payload = JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      scheduleInfo: '每天 09:00 与 21:00 自动巡检刷新 (Google Flights 实时 GDS 引擎)',
      settings: appState.settings,
      coupons: appState.coupons,
      platforms: PLATFORMS,
      priceHistory: appState.priceHistory,
      favorites: appState.favorites || [],
      snapshot: latestSnapshot
    }, null, 2);

    const rootDataPath = path.join(__dirname, 'data', 'latest.json');
    const publicDataPath = path.join(__dirname, 'public', 'data', 'latest.json');
    fs.writeFileSync(rootDataPath, payload, 'utf8');
    fs.writeFileSync(publicDataPath, payload, 'utf8');
    console.log('💾 [本地服务] 实时最新数据已同步更新至 data/latest.json 及 public/data/latest.json');
  } catch (err) {
    console.warn('⚠️ [本地服务] 写入静态文件失败:', err.message);
  }

  return latestSnapshot;
}

/**
 * 发送 iOS Bark 推送（若用户配置了 Bark URL）
 */
function sendBarkPush(barkUrl, title, body) {
  return new Promise((resolve, reject) => {
    try {
      const cleanBase = barkUrl.replace(/\/+$/, '');
      const fullUrl = `${cleanBase}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=${encodeURIComponent('机票监控')}&sound=calypso`;
      const client = fullUrl.startsWith('https') ? https : http;
      const req = client.get(fullUrl, { timeout: 4000 }, res => {
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
      });
      req.on('error', err => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Bark 请求超时'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // API: 获取完整监控仪表盘数据
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      if (!latestSnapshot) {
        await refreshFlightData(true);
      }
      const lanIp = getLocalLanIp();
      return sendJson(res, 200, {
        ok: true,
        serverInfo: {
          lanIp,
          port: PORT,
          mobileUrl: `http://${lanIp}:${PORT}`,
          localUrl: `http://localhost:${PORT}`
        },
        settings: appState.settings,
        coupons: appState.coupons,
        platforms: PLATFORMS,
        priceHistory: appState.priceHistory,
        favorites: appState.favorites || [],
        snapshot: latestSnapshot
      });
    }

    // API: 立即刷新实时运价
    if (pathname === '/api/refresh' && req.method === 'POST') {
      await refreshFlightData(true);
      return sendJson(res, 200, {
        ok: true,
        snapshot: latestSnapshot,
        priceHistory: appState.priceHistory
      });
    }

    // API: 切换优惠券开关
    if (pathname === '/api/coupons/toggle' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { id, enabled } = body;
      if (id === '__ALL__') {
        appState.coupons.forEach(c => {
          c.enabled = Boolean(enabled);
        });
      } else {
        const target = appState.coupons.find(c => c.id === id);
        if (target) {
          target.enabled = enabled !== undefined ? Boolean(enabled) : !target.enabled;
        }
      }
      saveState(appState);
      await refreshFlightData(false);
      return sendJson(res, 200, {
        ok: true,
        coupons: appState.coupons,
        snapshot: latestSnapshot
      });
    }

    // API: 新增自定义优惠券
    if (pathname === '/api/coupons/add' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const newCoupon = {
        id: `custom_${Date.now()}`,
        platform: body.platform || 'ALL',
        name: (body.name || '自定义优惠券').trim(),
        category: body.category || 'platform_coupon',
        type: 'threshold_minus',
        minSpend: Number(body.minSpend) || 0,
        discountAmount: Number(body.discountAmount) || 100,
        cabinLimit: body.cabinLimit || 'ALL',
        tripTypeLimit: body.tripTypeLimit || 'ALL',
        AirlineLimit: 'ALL',
        enabled: true,
        isCustom: true,
        stackableWithPayment: body.category !== 'payment_discount',
        description: body.description || `满 ¥${Number(body.minSpend) || 0} 立减 ¥${Number(body.discountAmount) || 100}`
      };
      appState.coupons.unshift(newCoupon);
      saveState(appState);
      await refreshFlightData(false);
      return sendJson(res, 200, {
        ok: true,
        coupons: appState.coupons,
        snapshot: latestSnapshot
      });
    }

    // API: 删除自定义优惠券
    if (pathname === '/api/coupons/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      appState.coupons = appState.coupons.filter(c => c.id !== body.id);
      saveState(appState);
      await refreshFlightData(false);
      return sendJson(res, 200, {
        ok: true,
        coupons: appState.coupons,
        snapshot: latestSnapshot
      });
    }

    // API: 更新监控设置（日期、低价提醒阈值、Bark URL）
    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      appState.settings = {
        ...appState.settings,
        ...(body.outboundDate ? { outboundDate: body.outboundDate } : {}),
        ...(body.inboundDate ? { inboundDate: body.inboundDate } : {}),
        ...(body.alertThresholdEconomy !== undefined ? { alertThresholdEconomy: Number(body.alertThresholdEconomy) } : {}),
        ...(body.alertThresholdDirect !== undefined ? { alertThresholdDirect: Number(body.alertThresholdDirect) } : {}),
        ...(body.alertThresholdBusiness !== undefined ? { alertThresholdBusiness: Number(body.alertThresholdBusiness) } : {}),
        ...(body.barkPushUrl !== undefined ? { barkPushUrl: String(body.barkPushUrl).trim() } : {})
      };
      saveState(appState);
      await refreshFlightData(true);
      return sendJson(res, 200, {
        ok: true,
        settings: appState.settings,
        snapshot: latestSnapshot,
        priceHistory: appState.priceHistory
      });
    }

    // API: 收藏/取消收藏航班方案
    if (pathname === '/api/favorites/toggle' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const flightId = body.flightId;
      if (!Array.isArray(appState.favorites)) appState.favorites = [];
      const idx = appState.favorites.indexOf(flightId);
      if (idx >= 0) {
        appState.favorites.splice(idx, 1);
      } else if (flightId) {
        appState.favorites.push(flightId);
      }
      saveState(appState);
      return sendJson(res, 200, { ok: true, favorites: appState.favorites });
    }

    // API: 测试 iOS Bark 推送或生成低价播报
    if (pathname === '/api/notify/test' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const barkUrl = (body.barkPushUrl || appState.settings.barkPushUrl || '').trim();
      const bestFlight = latestSnapshot && latestSnapshot.allComboFlights && latestSnapshot.allComboFlights[0];
      const title = '✈️ 意大利机票低价监控提醒';
      const msg = bestFlight
        ? `${bestFlight.shortLabel} (${bestFlight.outbound.date}去/${bestFlight.inbound.date}回) 最低实付 ¥${bestFlight.finalNetPrice} [${bestFlight.airlineDisplay} · ${bestFlight.bestPlatform.shortName}]`
        : '4/10上海-米兰/罗马，4/24返程监控运行正常';

      if (barkUrl) {
        try {
          const pushRes = await sendBarkPush(barkUrl, title, msg);
          return sendJson(res, 200, { ok: true, pushed: true, pushRes, title, message: msg });
        } catch (err) {
          return sendJson(res, 200, { ok: false, pushed: false, error: err.message, title, message: msg });
        }
      }
      return sendJson(res, 200, { ok: true, pushed: false, title, message: msg });
    }

    // 静态文件服务
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    // 防止目录穿越
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

// 启动初始化并设置定时监控任务
refreshFlightData(true).then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    const lanIp = getLocalLanIp();
    console.log('============================================================');
    console.log('✈️  上海 ⇄ 米兰/罗马 机票价格与优惠券监控中心已启动！');
    console.log(`💻 电脑浏览器访问: http://localhost:${PORT}`);
    console.log(`📱 iOS 手机端访问: http://${lanIp}:${PORT} (同一Wi-Fi下扫码直达)`);
    console.log('============================================================');
  });
});

// 每 15 分钟后台自动巡检一次价格
setInterval(() => {
  refreshFlightData(true).catch(err => console.error('定时巡检异常:', err.message));
}, 15 * 60 * 1000);
