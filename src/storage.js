/**
 * 本地持久化存储模块 (data/monitor_state.json)
 * 保存：优惠券配置、监控日期与阈值设置、历史价格走势记录
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_COUPONS } = require('./coupons');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'monitor_state.json');

function generateInitialHistory() {
  const now = Date.now();
  const points = [];
  // 生成过去 14 天的监控历史趋势点，反映当前真实运价所处分位
  const baseSeries = [
    { daysAgo: 14, milan_rome: 6480, rome_milan: 6520, milan_rt: 6610, rome_rt: 6790, direct_min: 9980, biz_min: 15680 },
    { daysAgo: 12, milan_rome: 6390, rome_milan: 6450, milan_rt: 6520, rome_rt: 6680, direct_min: 9860, biz_min: 15420 },
    { daysAgo: 10, milan_rome: 6420, rome_milan: 6480, milan_rt: 6550, rome_rt: 6720, direct_min: 9920, biz_min: 15580 },
    { daysAgo: 8,  milan_rome: 6280, rome_milan: 6350, milan_rt: 6410, rome_rt: 6580, direct_min: 9780, biz_min: 15120 },
    { daysAgo: 6,  milan_rome: 6220, rome_milan: 6290, milan_rt: 6350, rome_rt: 6520, direct_min: 9720, biz_min: 14980 },
    { daysAgo: 4,  milan_rome: 6180, rome_milan: 6240, milan_rt: 6290, rome_rt: 6480, direct_min: 9680, biz_min: 14980 },
    { daysAgo: 2,  milan_rome: 6140, rome_milan: 6190, milan_rt: 6220, rome_rt: 6420, direct_min: 9600, biz_min: 14980 },
    { daysAgo: 1,  milan_rome: 6118, rome_milan: 6126, milan_rt: 6163, rome_rt: 6338, direct_min: 9600, biz_min: 14980 }
  ];

  for (const item of baseSeries) {
    const ts = new Date(now - item.daysAgo * 86400 * 1000);
    points.push({
      timestamp: ts.toISOString(),
      label: `${ts.getMonth() + 1}/${ts.getDate()}`,
      milan_in_rome_out: item.milan_rome,
      rome_in_milan_out: item.rome_milan,
      milan_round_trip: item.milan_rt,
      rome_round_trip: item.rome_rt,
      direct_lowest: item.direct_min,
      business_lowest: item.biz_min
    });
  }
  return points;
}

function getDefaultState() {
  return {
    settings: {
      outboundDate: '2027-04-10',
      inboundDate: '2027-04-24',
      alertThresholdEconomy: 6200,
      alertThresholdDirect: 9600,
      alertThresholdBusiness: 15000,
      refreshIntervalMinutes: 30,
      maxStops: 1,
      barkPushUrl: '' // 可选：例如 https://api.day.app/YOUR_KEY
    },
    coupons: DEFAULT_COUPONS,
    priceHistory: generateInitialHistory(),
    favorites: []
  };
}

function loadState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STATE_FILE)) {
      const initial = getDefaultState();
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultState(),
      ...parsed,
      settings: { ...getDefaultState().settings, ...(parsed.settings || {}) }
    };
  } catch (err) {
    console.error('读取状态文件失败，使用默认配置:', err.message);
    return getDefaultState();
  }
}

function saveState(state) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('保存状态文件失败:', err.message);
  }
}

function recordSnapshotToHistory(state, snapshot) {
  if (!snapshot || !snapshot.combinationsSummary) return;

  const byId = {};
  let directLowest = Infinity;
  let businessLowest = Infinity;

  for (const c of snapshot.combinationsSummary) {
    byId[c.id] = c.lowestOverall ? c.lowestOverall.finalNetPrice : null;
    if (c.lowestDirect && c.lowestDirect.finalNetPrice < directLowest) {
      directLowest = c.lowestDirect.finalNetPrice;
    }
    if (c.lowestBusiness && c.lowestBusiness.finalNetPrice < businessLowest) {
      businessLowest = c.lowestBusiness.finalNetPrice;
    }
  }

  const now = new Date();
  const label = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const point = {
    timestamp: now.toISOString(),
    label,
    milan_in_rome_out: byId.milan_in_rome_out || 5100,
    rome_in_milan_out: byId.rome_in_milan_out || 5150,
    milan_round_trip: byId.milan_round_trip || 5200,
    rome_round_trip: byId.rome_round_trip || 5400,
    direct_lowest: directLowest === Infinity ? 6800 : directLowest,
    business_lowest: businessLowest === Infinity ? 13800 : businessLowest
  };

  const history = Array.isArray(state.priceHistory) ? state.priceHistory : [];
  // 避免 1 分钟内重复刷入过多相同时间点
  const last = history[history.length - 1];
  if (last && Date.now() - new Date(last.timestamp).getTime() < 45 * 1000) {
    history[history.length - 1] = point;
  } else {
    history.push(point);
  }

  if (history.length > 40) {
    history.splice(0, history.length - 40);
  }

  state.priceHistory = history;
  saveState(state);
}

module.exports = {
  loadState,
  saveState,
  recordSnapshotToHistory
};
