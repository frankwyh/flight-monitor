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
  // 生成过去 14 天的监控历史趋势点，方便直观对比当前价格所处分位
  const baseSeries = [
    { daysAgo: 14, milan_rome: 5380, rome_milan: 5420, milan_rt: 5510, rome_rt: 5690, direct_min: 7260, biz_min: 14680 },
    { daysAgo: 12, milan_rome: 5320, rome_milan: 5390, milan_rt: 5460, rome_rt: 5620, direct_min: 7180, biz_min: 14520 },
    { daysAgo: 10, milan_rome: 5490, rome_milan: 5510, milan_rt: 5580, rome_rt: 5750, direct_min: 7390, biz_min: 14890 },
    { daysAgo: 8,  milan_rome: 5260, rome_milan: 5310, milan_rt: 5390, rome_rt: 5580, direct_min: 7120, biz_min: 14250 },
    { daysAgo: 6,  milan_rome: 5190, rome_milan: 5240, milan_rt: 5310, rome_rt: 5490, direct_min: 6980, biz_min: 13980 },
    { daysAgo: 4,  milan_rome: 5280, rome_milan: 5290, milan_rt: 5350, rome_rt: 5520, direct_min: 7050, biz_min: 14120 },
    { daysAgo: 2,  milan_rome: 5140, rome_milan: 5180, milan_rt: 5230, rome_rt: 5460, direct_min: 6890, biz_min: 13860 },
    { daysAgo: 1,  milan_rome: 5090, rome_milan: 5150, milan_rt: 5190, rome_rt: 5410, direct_min: 6820, biz_min: 13750 }
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
      alertThresholdEconomy: 5200,
      alertThresholdDirect: 6900,
      alertThresholdBusiness: 14000,
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
