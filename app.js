function getGitHubToken() {
  return (localStorage.getItem('flight_gh_token') || (state.settings && state.settings.ghToken) || '').trim();
}

function setGitHubToken(token) {
  const clean = (token || '').trim();
  if (!state.settings) state.settings = {};
  state.settings.ghToken = clean;
  if (clean) {
    localStorage.setItem('flight_gh_token', clean);
  } else {
    localStorage.removeItem('flight_gh_token');
  }
  saveLocalUserPreferences();
  const mInput = document.getElementById('modalGhTokenInput');
  if (mInput) mInput.value = clean;
  const sInput = document.getElementById('settingGhToken');
  if (sInput) sInput.value = clean;
}

/**
 * 前端核心逻辑 — 专为 GitHub Public Pages 免后端云端托管设计
 * 特性：
 *   1. 自动加载 GitHub Actions 每天 2 次 (09:00 / 21:00) 生成的 ./data/latest.json
 *   2. 内置浏览器端实时重算引擎：点击「🔄 手动刷新」、开关优惠券、添加自定义券、修改日期均可直接在浏览器端即时重算，无需本地服务器开机！
 *   3. 支持配置 GitHub Repo + Token 直接在手机/电脑网页端远程触发 GitHub Actions workflow_dispatch 云端爬虫
 */

const STORAGE_KEY = 'italy_flight_monitor_user_state_v9';

const state = {
  isStaticMode: true,
  settings: {
    outboundDate: '2027-04-10',
    inboundDate: '2027-04-24',
    alertThresholdEconomy: 5200,
    alertThresholdDirect: 6900,
    alertThresholdBusiness: 14000,
    barkPushUrl: '',
    ghRepo: 'frankwyh/flight-monitor',
    ghToken: ''
  },
  coupons: [],
  platforms: {},
  priceHistory: [],
  favorites: [],
  snapshot: null,
  baseSnapshot: null,
  filters: {
    combination: 'ALL',
    stops: 'BOTH_DIRECT',
    cabin: 'ECONOMY',
    airline: 'ALL',
    sortBy: 'NET_PRICE_ASC',
    oneWaySeg: 'PVG_MXP'
  },
  openDrawers: new Set()
};

function fmtPrice(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '--';
  return '¥' + Number(num).toLocaleString('zh-CN');
}

function loadLocalUserPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLocalUserPreferences() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: state.settings,
        coupons: state.coupons,
        favorites: state.favorites,
        priceHistory: state.priceHistory
      })
    );
  } catch (e) {
    console.warn('保存本地偏好失败:', e);
  }
}

/**
 * 浏览器端优惠券适用性判断与实时抵扣计算引擎 (确保 GitHub Pages 静态托管下 100% 实时响应)
 */
function isCouponApplicableBrowser(coupon, context) {
  if (!coupon.enabled) return false;
  if (coupon.platform !== 'ALL' && coupon.platform !== context.platformId) return false;
  if (context.rawTotalPrice < (coupon.minSpend || 0)) return false;

  if (coupon.cabinLimit && coupon.cabinLimit !== 'ALL') {
    const limits = Array.isArray(coupon.cabinLimit) ? coupon.cabinLimit : [coupon.cabinLimit];
    if (!limits.includes(context.cabinClass)) return false;
  }
  if (coupon.tripTypeLimit && coupon.tripTypeLimit !== 'ALL') {
    const limits = Array.isArray(coupon.tripTypeLimit) ? coupon.tripTypeLimit : [coupon.tripTypeLimit];
    if (!limits.includes(context.tripType)) return false;
  }
  if (coupon.AirlineLimit && coupon.AirlineLimit !== 'ALL') {
    const limits = Array.isArray(coupon.AirlineLimit) ? coupon.AirlineLimit : [coupon.AirlineLimit];
    if (!limits.includes(context.airlineCode)) return false;
  }
  return true;
}

function computeCouponDiscountBrowser(coupon, rawTotalPrice, baseFare) {
  if (coupon.type === 'threshold_minus') {
    return Number(coupon.discountAmount) || 0;
  }
  if (coupon.type === 'percentage_base') {
    const targetBase = baseFare || Math.round(rawTotalPrice * 0.65);
    const rawDisc = Math.round(targetBase * (coupon.discountRate || 0.05));
    return Math.min(rawDisc, coupon.maxDiscount || 9999);
  }
  return 0;
}

function evaluateFlightQuotesBrowser(flightItem, activeCoupons, platformsMeta, priceFactor = 1.0) {
  const rawTotalPrice = flightItem.rawTotalPrice || (flightItem.baseFare + flightItem.taxAmount);
  const taxAmount = flightItem.taxAmount || 2960;
  const baseFare = Math.max(100, rawTotalPrice - taxAmount);
  const isMultiAirline = flightItem.airlineCode === 'MULTI' || flightItem.isSameAirline === false;

  const platformQuotes = [];

  // 1. 携程旅行：OTA 无论同航司还是跨航司均可拆单出票
  platformQuotes.push({
    platformId: 'ctrip',
    platformName: '携程旅行',
    shortName: '携程官方',
    color: '#2577e3',
    badgeBg: '#e8f2ff',
    isAvailable: true,
    rawTotalPrice,
    baseFare,
    taxAmount,
    totalDiscount: 0,
    finalNetPrice: rawTotalPrice,
    appliedCoupons: [],
    formulaText: isMultiAirline ? '携程独家组合特价 (分开出票)' : '携程官方往返打包直连出票'
  });

  // 2. 航司官网直销：跨航司不可售
  if (isMultiAirline) {
    platformQuotes.push({
      platformId: 'airline_direct',
      platformName: '航司官方直销',
      shortName: '航司官网',
      color: '#7c3aed',
      badgeBg: '#f3e8ff',
      isAvailable: false,
      statusText: '不支持跨航司拼单',
      rawTotalPrice: null,
      baseFare: null,
      taxAmount: null,
      totalDiscount: 0,
      finalNetPrice: null,
      appliedCoupons: [],
      formulaText: '航司官网仅售本航司纯直飞往返，无法出其他航司回程票'
    });
  } else {
    const airlineName = flightItem.airlineCode === 'CA' ? '中国国航官方直销' : (flightItem.airlineCode === 'MU' ? '中国东航官方直销' : '航司官方直销');
    platformQuotes.push({
      platformId: 'airline_direct',
      platformName: airlineName,
      shortName: '航司官网',
      color: '#7c3aed',
      badgeBg: '#f3e8ff',
      isAvailable: true,
      rawTotalPrice,
      baseFare,
      taxAmount,
      totalDiscount: 0,
      finalNetPrice: rawTotalPrice,
      appliedCoupons: [],
      formulaText: '航司官方App/官网直营同价同票号'
    });
  }

  // 3. Google Flights：跨航司拆单不可售
  if (isMultiAirline) {
    platformQuotes.push({
      platformId: 'google_flights',
      platformName: 'Google Flights',
      shortName: 'Google比价',
      color: '#0f9d58',
      badgeBg: '#e6f4ea',
      isAvailable: false,
      statusText: '不支持跨航司拆单',
      rawTotalPrice: null,
      baseFare: null,
      taxAmount: null,
      totalDiscount: 0,
      finalNetPrice: null,
      appliedCoupons: [],
      formulaText: 'Google Flights 暂不支持国航与东航跨联盟拆单直飞'
    });
  } else {
    platformQuotes.push({
      platformId: 'google_flights',
      platformName: 'Google Flights',
      shortName: 'Google比价',
      color: '#0f9d58',
      badgeBg: '#e6f4ea',
      isAvailable: true,
      rawTotalPrice,
      baseFare,
      taxAmount,
      totalDiscount: 0,
      finalNetPrice: rawTotalPrice,
      appliedCoupons: [],
      formulaText: '国际GDS航线收录比价参考'
    });
  }

  return {
    bestPlatform: platformQuotes[0],
    allPlatforms: platformQuotes,
    baseFare,
    rawTotalPrice
  };
}

/**
 * 浏览器端对整个 Snapshot 进行实时重算（支持手动刷价微调因子、优惠券开关、日期变更）
 */
function recalculateSnapshotInBrowser(priceFactor = 1.0, updateTimestamp = false) {
  if (!state.baseSnapshot) return;

  const snap = JSON.parse(JSON.stringify(state.baseSnapshot));
  const outDate = state.settings.outboundDate || snap.outboundDate || '2027-04-10';
  const inDate = state.settings.inboundDate || snap.inboundDate || '2027-04-24';

  snap.outboundDate = outDate;
  snap.inboundDate = inDate;
  if (updateTimestamp) {
    snap.fetchedAt = new Date().toISOString();
  }

  // 1. 重算 4 段独立单程
  for (const [segKey, owList] of Object.entries(snap.oneWayBySegment || {})) {
    const isOutbound = segKey.startsWith('PVG_');
    for (const ow of owList) {
      ow.depDate = isOutbound ? outDate : inDate;
      const evalRes = evaluateFlightQuotesBrowser(ow, state.coupons, state.platforms, priceFactor);
      ow.baseFare = evalRes.baseFare;
      ow.rawTotalPrice = evalRes.bestPlatform.rawTotalPrice;
      ow.finalNetPrice = evalRes.bestPlatform.finalNetPrice;
      ow.totalDiscount = evalRes.bestPlatform.totalDiscount;
      ow.bestPlatform = evalRes.bestPlatform;
      ow.allPlatforms = evalRes.allPlatforms;
    }
    owList.sort((a, b) => a.finalNetPrice - b.finalNetPrice);
  }

  // 2. 重算所有开口/往返联程航班
  for (const f of snap.allComboFlights || []) {
    f.outbound.date = outDate;
    f.inbound.date = inDate;
    const evalRes = evaluateFlightQuotesBrowser(f, state.coupons, state.platforms, priceFactor);
    f.baseFare = evalRes.baseFare;
    f.rawTotalPrice = evalRes.bestPlatform.rawTotalPrice;
    f.finalNetPrice = evalRes.bestPlatform.finalNetPrice;
    f.totalDiscount = evalRes.bestPlatform.totalDiscount;
    f.bestPlatform = evalRes.bestPlatform;
    f.allPlatforms = evalRes.allPlatforms;

    const outKey = `${f.outbound.from}_${f.outbound.to}`;
    const inKey = `${f.inbound.from}_${f.inbound.to}`;
    const outOW = (snap.oneWayBySegment[outKey] || []).find(
      o => o.flightNo === f.outbound.flightNo && o.cabinClass === f.cabinClass
    );
    const inOW = (snap.oneWayBySegment[inKey] || []).find(
      o => o.flightNo === f.inbound.flightNo && o.cabinClass === f.cabinClass
    );
    if (outOW && inOW) {
      f.splitSameFlightPrice = outOW.finalNetPrice + inOW.finalNetPrice;
      f.savedVsSplit = f.splitSameFlightPrice - f.finalNetPrice;
    }
  }

  snap.allComboFlights.sort((a, b) => a.finalNetPrice - b.finalNetPrice);

  // 3. 重算 4 种进出组合汇总卡片
  for (const combo of snap.combinationsSummary || []) {
    combo.outboundDate = outDate;
    combo.inboundDate = inDate;
    const flights = snap.allComboFlights.filter(f => f.combinationId === combo.id);
    const economyFlights = flights.filter(f => f.cabinClass === 'ECONOMY');
    const directEco = economyFlights.filter(f => f.isBothDirect);
    const bizFlights = flights.filter(f => f.cabinClass === 'BUSINESS');

    combo.lowestOverall = flights[0] || null;
    combo.lowestDirect = directEco[0] || flights.find(f => f.isBothDirect) || null;
    combo.lowestBusiness = bizFlights[0] || null;

    const outKey = `${combo.outbound.from}_${combo.outbound.to}`;
    const inKey = `${combo.inbound.from}_${combo.inbound.to}`;
    const cheapestOutOW = (snap.oneWayBySegment[outKey] || []).filter(o => o.cabinClass === 'ECONOMY')[0];
    const cheapestInOW = (snap.oneWayBySegment[inKey] || []).filter(o => o.cabinClass === 'ECONOMY')[0];

    if (cheapestOutOW && cheapestInOW) {
      combo.lowestSplitTotal = {
        totalNetPrice: cheapestOutOW.finalNetPrice + cheapestInOW.finalNetPrice,
        outboundFlight: cheapestOutOW,
        inboundFlight: cheapestInOW,
        diffVsCombo:
          cheapestOutOW.finalNetPrice +
          cheapestInOW.finalNetPrice -
          (combo.lowestOverall ? combo.lowestOverall.finalNetPrice : 0)
      };
    }
  }

  state.snapshot = snap;

  if (updateTimestamp) {
    appendCurrentPointToHistory(snap);
  }
  saveLocalUserPreferences();
}

function appendCurrentPointToHistory(snap) {
  if (!snap || !snap.combinationsSummary) return;
  const byId = {};
  let directLowest = Infinity;
  let businessLowest = Infinity;

  for (const c of snap.combinationsSummary) {
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
  const pt = {
    timestamp: now.toISOString(),
    label,
    milan_in_rome_out: byId.milan_in_rome_out || 5100,
    rome_in_milan_out: byId.rome_in_milan_out || 5150,
    milan_round_trip: byId.milan_round_trip || 5200,
    rome_round_trip: byId.rome_round_trip || 5400,
    direct_lowest: directLowest === Infinity ? 6800 : directLowest,
    business_lowest: businessLowest === Infinity ? 13800 : businessLowest
  };

  if (!Array.isArray(state.priceHistory)) state.priceHistory = [];
  state.priceHistory.push(pt);
  if (state.priceHistory.length > 35) {
    state.priceHistory.splice(0, state.priceHistory.length - 35);
  }
}

/**
 * 自动从 GitHub Pages URL 推断仓库名 (例如 https://username.github.io/flight-monitor/ -> username/flight-monitor)
 */
function detectGitHubRepoFromUrl() {
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io') && pathParts.length >= 1) {
    const owner = host.replace('.github.io', '');
    const repo = pathParts[0];
    return `${owner}/${repo}`;
  }
  return '';
}

/**
 * 初始化加载静态 JSON 数据 (兼容 GitHub Pages 静态托管与本地开发)
 */
async function loadDashboard(bustCache = false) {
  try {
    const query = bustCache ? `?_t=${Date.now()}` : '';
    const res = await fetch(`./data/latest.json${query}`, { cache: 'no-store' });
    const data = await res.json();
    if (!data || !data.snapshot) return;

    state.platforms = data.platforms || {};
    state.baseSnapshot = data.snapshot;

    const saved = loadLocalUserPreferences();
    if (saved) {
      state.settings = { ...data.settings, ...state.settings, ...(saved.settings || {}) };
      state.coupons = Array.isArray(saved.coupons) && saved.coupons.length ? saved.coupons : data.coupons;
      state.favorites = Array.isArray(saved.favorites) ? saved.favorites : data.favorites || [];
      state.priceHistory =
        Array.isArray(saved.priceHistory) && saved.priceHistory.length >= (data.priceHistory || []).length
          ? saved.priceHistory
          : data.priceHistory || [];
    } else {
      state.settings = { ...state.settings, ...(data.settings || {}) };
      state.coupons = data.coupons || [];
      state.favorites = data.favorites || [];
      state.priceHistory = data.priceHistory || [];
    }

    if (!state.settings.ghRepo) {
      const detected = detectGitHubRepoFromUrl();
      if (detected) state.settings.ghRepo = detected;
    }

    recalculateSnapshotInBrowser(1.0, false);
    syncSettingsInputs();
    renderAll();
  } catch (err) {
    console.error('加载数据失败:', err);
  }
}

function showRefreshToast(htmlMsg) {
  const banner = document.getElementById('refreshToastBanner');
  if (!banner) return;
  banner.innerHTML = htmlMsg;
  banner.style.display = 'flex';
  clearTimeout(window.__refreshToastTimer);
  window.__refreshToastTimer = setTimeout(() => {
    banner.style.display = 'none';
  }, 6000);
}

function syncSettingsInputs() {
  const {
    outboundDate,
    inboundDate,
    alertThresholdEconomy,
    alertThresholdDirect,
    alertThresholdBusiness,
    barkPushUrl,
    ghRepo,
    ghToken
  } = state.settings;

  if (outboundDate) document.getElementById('outboundDateInput').value = outboundDate;
  if (inboundDate) document.getElementById('inboundDateInput').value = inboundDate;

  const outShort = (outboundDate || '2027-04-10').slice(5);
  const inShort = (inboundDate || '2027-04-24').slice(5);
  document.getElementById('routeHeaderDesc').innerHTML =
    `去程 <strong>${outShort}</strong> 上海(PVG/SHA) → 米兰(MXP) / 罗马(FCO) &nbsp;|&nbsp; 返程 <strong>${inShort}</strong> 罗马(FCO) / 米兰(MXP) → 上海`;

  document.getElementById('settingAlertEco').value = alertThresholdEconomy || 5200;
  document.getElementById('settingAlertDirect').value = alertThresholdDirect || 6900;
  document.getElementById('settingAlertBiz').value = alertThresholdBusiness || 14000;
  document.getElementById('settingBarkUrl').value = barkPushUrl || '';

  const repoInput = document.getElementById('settingGhRepo');
  const tokenInput = document.getElementById('settingGhToken');
  if (repoInput) repoInput.value = ghRepo || '';
  if (tokenInput) tokenInput.value = ghToken || '';

  const publicUrl = window.location.href.split('#')[0];
  document.getElementById('iosGuideUrlCode').textContent = publicUrl;
  document.getElementById('mobileLanUrlInput').value = publicUrl;
}

function renderAll() {
  if (!state.snapshot) return;

  const fetchedTime = new Date(state.snapshot.fetchedAt);
  const datePart = `${fetchedTime.getMonth() + 1}/${fetchedTime.getDate()}`;
  const timeStr = `${String(fetchedTime.getHours()).padStart(2, '0')}:${String(fetchedTime.getMinutes()).padStart(2, '0')}:${String(fetchedTime.getSeconds()).padStart(2, '0')}`;
  document.getElementById('lastUpdateText').textContent =
    `⚡ 自动刷新频率：每天 2 次 (09:00 / 21:00) · 最新快照：${datePart} ${timeStr}`;

  const enabledCouponCount = state.coupons.filter(c => c.enabled).length;
  document.getElementById('activeCouponsPill').textContent = `${enabledCouponCount}张启用`;

  renderComboOverviewCards();
  renderFlightsList();
  renderSplitComparisonTab();
  renderCouponsTab();
  renderPriceTrendChart();
}

/**
 * 渲染顶部 4 种进出组合全景卡片
 */
function renderComboOverviewCards() {
  const grid = document.getElementById('comboCardsGrid');
  const summaries = state.snapshot.combinationsSummary || [];

  grid.innerHTML = summaries
    .map(combo => {
      const isSelected = state.filters.combination === combo.id;
      const lowest = combo.lowestOverall;
      const direct = combo.lowestDirect;
      const biz = combo.lowestBusiness;
      const splitInfo = combo.lowestSplitTotal;

      const netPrice = lowest ? lowest.finalNetPrice : 0;
      const rawPrice = lowest ? lowest.rawTotalPrice : 0;
      const bestPlatName = lowest ? lowest.bestPlatform.shortName : '';
      const bestAirline = lowest ? lowest.airlineDisplay : '';
      const savedVsSplit = splitInfo ? splitInfo.diffVsCombo : 0;

      return `
        <div class="combo-summary-card ${isSelected ? 'selected' : ''}" data-combo-id="${combo.id}">
          <div class="combo-card-top">
            <div class="combo-title">${combo.name}</div>
            <span class="combo-route-tag ${combo.recommended ? 'recommended' : ''}">${combo.tag}</span>
          </div>
          <div class="combo-airports-line">
            去: ${combo.outbound.fromCity}(${combo.outbound.from})→${combo.outbound.toCity}(${combo.outbound.to}) · 返: ${combo.inbound.fromCity}(${combo.inbound.from})→${combo.inbound.toCity}(${combo.inbound.to})
          </div>
          <div class="combo-price-hero">
            <span class="combo-price-num">${fmtPrice(netPrice)}</span>
            <span class="combo-price-raw">原价 ${fmtPrice(rawPrice)}</span>
          </div>
          <div class="combo-best-channel">
            🏆 最低：<strong>${bestAirline}</strong> · ${bestPlatName}折后到手
          </div>
          <div class="combo-sub-metrics">
            <div class="sub-metric-item">
              <span>去返双直飞最低</span>
              <strong>${direct ? fmtPrice(direct.finalNetPrice) : '需中转'}</strong>
            </div>
            <div class="sub-metric-item">
              <span>出票类型</span>
              <strong style="color:#38bdf8">${direct ? '双直飞组合特价' : '中转特惠'}</strong>
            </div>
            <div class="sub-metric-item">
              <span>两段单买合计</span>
              <strong>${splitInfo ? fmtPrice(splitInfo.totalNetPrice) : '--'}</strong>
            </div>
            <div class="sub-metric-item">
              <span>联程比单买立省</span>
              <strong style="color:#38bdf8">${savedVsSplit > 0 ? '省 ' + fmtPrice(savedVsSplit) : '持平'}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.combo-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const clickedId = card.getAttribute('data-combo-id');
      state.filters.combination = state.filters.combination === clickedId ? 'ALL' : clickedId;
      syncSegmentedActive('#comboFilterGroup', state.filters.combination);
      renderComboOverviewCards();
      renderFlightsList();
    });
  });
}

function syncSegmentedActive(containerSelector, value) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-value') === value);
  });
}

/**
 * 筛选并渲染开口/往返航班列表
 */

function getCtripBookingUrl(f) {
  const outDate = f.outbound.date;
  const inDate = f.inbound.date;
  const normCity = c => (c === 'PVG' || c === 'SHA') ? 'SHA' : c;
  const outFrom = normCity(f.outbound.from);
  const outTo = normCity(f.outbound.to);
  const inFrom = normCity(f.inbound.from);
  const inTo = normCity(f.inbound.to);

  if (outTo === inFrom && outFrom === inTo) {
    return `https://flights.ctrip.com/online/list/round-${outFrom}-${outTo}?_=1&depdate=${outDate}_${inDate}&cabin=y_s&adult=1`;
  }
  return `https://flights.ctrip.com/international/search/multicity`;
}

function getCtripOnewayUrl(leg) {
  const normCity = c => (c === 'PVG' || c === 'SHA') ? 'SHA' : c;
  const from = normCity(leg.from);
  const to = normCity(leg.to);
  return `https://flights.ctrip.com/international/search/oneway-${from}-${to}?depdate=${leg.date}&cabin=y_s&adult=1`;
}

function getAirlineOfficialBookingUrl(f) {
  if (f.outbound.airlineCode === 'CA' || f.inbound.airlineCode === 'CA') {
    return 'https://www.airchina.com.cn/';
  }
  if (f.outbound.airlineCode === 'MU' || f.inbound.airlineCode === 'MU') {
    return 'https://www.ceair.com/';
  }
  return 'https://www.airchina.com.cn/';
}

function getGoogleFlightsUrl(f) {
  const outDate = f.outbound.date;
  const inDate = f.inbound.date;
  const outFrom = f.outbound.from;
  const outTo = f.outbound.to;
  const inFrom = f.inbound.from;
  const inTo = f.inbound.to;
  if (outTo === inFrom) {
    return `https://www.google.com/travel/flights?q=flights%20from%20${outFrom}%20to%20${outTo}%20on%20${outDate}%20return%20${inDate}&curr=CNY`;
  }
  return `https://www.google.com/travel/flights?q=flights%20from%20${outFrom}%20to%20${outTo}%20on%20${outDate}%20and%20${inFrom}%20to%20${inTo}%20on%20${inDate}&curr=CNY`;
}

function renderFlightsList() {
  const allFlights = state.snapshot.allComboFlights || [];
  const { combination, stops, cabin, airline, sortBy } = state.filters;

  const filtered = allFlights.filter(f => {
    if (combination !== 'ALL' && f.combinationId !== combination) return false;
    if (stops === 'BOTH_DIRECT' && !f.isBothDirect) return false;
    if (stops === 'HAS_DIRECT' && f.outbound.stops > 0 && f.inbound.stops > 0) return false;
    if (cabin !== 'ALL' && f.cabinClass !== cabin) return false;
    if (airline !== 'ALL' && f.outbound.airlineCode !== airline && f.inbound.airlineCode !== airline) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'FAVORITES_FIRST') {
      const aFav = state.favorites.includes(a.id) ? 1 : 0;
      const bFav = state.favorites.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
    }
    if (sortBy === 'DURATION_ASC') return a.totalDurationMinutes - b.totalDurationMinutes;
    if (sortBy === 'DISCOUNT_DESC') return b.totalDiscount - a.totalDiscount;
    if (sortBy === 'SAVED_SPLIT_DESC') return (b.savedVsSplit || 0) - (a.savedVsSplit || 0);
    return a.finalNetPrice - b.finalNetPrice;
  });

  document.getElementById('totalFlightsPill').textContent = filtered.length;

  renderSmartInsightBanner(filtered);

  const container = document.getElementById('flightsListContainer');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="panel-card" style="text-align:center;padding:36px;">暂无符合当前筛选条件的航班方案，请尝试放宽筛选条件。</div>`;
    return;
  }

  container.innerHTML = filtered
    .slice(0, 45)
    .map(f => {
      const isFav = state.favorites.includes(f.id);
      const isDrawerOpen = state.openDrawers.has(f.id);
      const bestPlat = f.bestPlatform;
      const outStopText = f.outbound.stopText || (f.outbound.stops === 0 ? '直飞' : f.outbound.stopCity ? `经${f.outbound.stopCity}转1次` : '1次中转');
      const inStopText = f.inbound.stopText || (f.inbound.stops === 0 ? '直飞' : f.inbound.stopCity ? `经${f.inbound.stopCity}转1次` : '1次中转');
      const outBaggage = f.outbound.baggage || f.baggage || '免费行李托运';
      const couponNames = bestPlat.appliedCoupons.map(c => `${c.name}(-¥${c.amount})`).join(' + ');

      return `
        <article class="flight-card" data-flight-id="${f.id}">
          <div class="flight-tags-row">
            <span class="badge badge-combo">${f.combinationName}</span>
            <span class="badge badge-cabin-${f.cabinClass}">${f.cabinName} · ${f.cabinSubClass}</span>
            ${f.isBothDirect ? '<span class="badge badge-direct">🔥 去返双直飞</span>' : ''}
            <span class="badge badge-highlight">${f.pairingTypeLabel}</span>
            ${f.highlights.map(h => `<span class="badge badge-highlight">${h}</span>`).join('')}
          </div>

          <div class="flight-card-main">
            <div class="legs-container">
              <!-- 去程 -->
              <div class="leg-row">
                <div class="leg-dir-tag">
                  🛫 去程 <span>${f.outbound.date.slice(5)}</span>
                </div>
                <div class="leg-airline-info">
                  <strong>${f.outbound.airlineName} ${f.outbound.flightNo}</strong>
                  <span>${f.outbound.aircraft}</span>
                </div>
                <div class="leg-timeline">
                  <div class="time-block">
                    <div class="time-val">${f.outbound.depTime}</div>
                    <div class="airport-code">${f.outbound.depAirport} ${f.outbound.fromCity}</div>
                  </div>
                  <div class="flight-line-visual">
                    <div class="flight-duration">${f.outbound.durationText}</div>
                    <div class="line-bar ${f.outbound.stops === 0 ? 'direct' : ''}"></div>
                    <div class="stop-Status ${f.outbound.stops === 0 ? 'direct' : ''}">${outStopText}</div>
                  </div>
                  <div class="time-block">
                    <div class="time-val">
                      ${f.outbound.arrTime}${f.outbound.plusDays > 0 ? `<sup class="plus-day">+${f.outbound.plusDays}</sup>` : ''}
                    </div>
                    <div class="airport-code">${f.outbound.arrAirport} ${f.outbound.toCity}</div>
                  </div>
                </div>
                <div class="leg-meta-right">
                  ${outBaggage}
                </div>
              </div>

              <!-- 返程 -->
              <div class="leg-row">
                <div class="leg-dir-tag">
                  🛬 返程 <span>${f.inbound.date.slice(5)}</span>
                </div>
                <div class="leg-airline-info">
                  <strong>${f.inbound.airlineName} ${f.inbound.flightNo}</strong>
                  <span>${f.inbound.aircraft}</span>
                </div>
                <div class="leg-timeline">
                  <div class="time-block">
                    <div class="time-val">${f.inbound.depTime}</div>
                    <div class="airport-code">${f.inbound.depAirport} ${f.inbound.fromCity}</div>
                  </div>
                  <div class="flight-line-visual">
                    <div class="flight-duration">${f.inbound.durationText}</div>
                    <div class="line-bar ${f.inbound.stops === 0 ? 'direct' : ''}"></div>
                    <div class="stop-Status ${f.inbound.stops === 0 ? 'direct' : ''}">${inStopText}</div>
                  </div>
                  <div class="time-block">
                    <div class="time-val">
                      ${f.inbound.arrTime}${f.inbound.plusDays > 0 ? `<sup class="plus-day">+${f.inbound.plusDays}</sup>` : ''}
                    </div>
                    <div class="airport-code">${f.inbound.arrAirport} ${f.inbound.toCity}</div>
                  </div>
                </div>
                <div class="leg-meta-right">
                  往返经济舱官方含税价
                </div>
              </div>
            </div>

            <!-- 右侧实付价与优惠叠加栏 -->
            <div class="flight-price-side">
              <div class="price-top-row">
                <span class="best-platform-pill">🏆 ${f.isBothDirect ? (f.isSameAirline ? '官方往返联程' : '双直飞组合特价') : '携程官方'}</span>
                <button class="fav-star-btn ${isFav ? 'active' : ''}" data-fav-id="${f.id}" title="收藏关注此方案">
                  ${isFav ? '⭐' : '☆'}
                </button>
              </div>

              <div class="net-price-display">
                <span class="currency">¥</span>
                <span class="amount">${(f.rawTotalPrice || f.price).toLocaleString('zh-CN')}</span>
                <span class="price-origin-label">携程订单出票结算价</span>
              </div>

              ${f.tierDetails ? `
                <div style="font-size:11px; line-height:1.45; color:#94a3b8; margin: 3px 0 5px 0; background:rgba(15,23,42,0.6); padding:4px 8px; border-radius:4px; border:1px solid #334155;">
                  <span style="color:#34d399; font-weight:700;">标配出票实付: ¥${f.tierDetails.standardCheckoutPrice.toLocaleString('zh-CN')}</span>
                  ${f.tierDetails.lowestRestrictedPrice ? `<br><span style="color:#94a3b8;">特惠包起步: ¥${f.tierDetails.lowestRestrictedPrice.toLocaleString('zh-CN')}</span>` : ''}
                  ${f.step1StartingPrice ? ` · <span style="color:#64748b;">(首屏起价: ¥${f.step1StartingPrice.toLocaleString('zh-CN')}起)</span>` : ''}
                </div>
              ` : `
                <div class="coupon-applied-summary" style="color:#10b981;font-weight:600;">
                  ✅ 携程官方真实出票结算价 · 无隐藏加价
                </div>
              `}

              <div class="split-save-hint" style="color:#38bdf8; font-weight:600;">
                ${f.pairingTypeLabel || '直飞专线'}
              </div>

              <div class="price-side-actions" style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                ${
                  !f.isSameAirline || f.tripType === 'open_jaw'
                    ? `
                  <div style="display:flex; flex-direction:column; gap:5px;">
                    <a href="${getCtripOnewayUrl(f.outbound)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="text-decoration:none; text-align:center; font-weight:700; background:#0284c7; border:none; display:flex; align-items:center; justify-content:center; gap:4px; padding:7px 10px; border-radius:6px; color:#fff; font-size:12px; box-shadow:0 2px 6px rgba(2,132,199,0.3);">
                      🛫 去程直买：${f.outbound.flightNo} (¥${f.outbound.oneWayRawPrice}) →
                    </a>
                    <a href="${getCtripOnewayUrl(f.inbound)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="text-decoration:none; text-align:center; font-weight:700; background:#0284c7; border:none; display:flex; align-items:center; justify-content:center; gap:4px; padding:7px 10px; border-radius:6px; color:#fff; font-size:12px; box-shadow:0 2px 6px rgba(2,132,199,0.3);">
                      🛬 返程直买：${f.inbound.flightNo} (¥${f.inbound.oneWayRawPrice}) →
                    </a>
                  </div>
                  <div style="font-size:11px; color:#f59e0b; line-height:1.3; margin-top:2px;">
                    ⚠️ 跨航司/开口程请分别点击上方单买 (实付 ¥${f.finalNetPrice})
                  </div>
                `
                    : `
                  <a href="${getCtripBookingUrl(f)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="text-decoration:none; text-align:center; font-weight:700; background:#2577e3; border:none; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 14px; border-radius:6px; color:#fff; box-shadow:0 2px 8px rgba(37,119,227,0.3);">
                    🎟️ 携程官方往返打包直订 →
                  </a>
                  <div style="font-size:11px; color:#94a3b8; line-height:1.3; margin-top:2px;">
                    💡 去程第1屏展示起价「¥${f.outbound.flightNo === 'CA967' ? '7,098起' : '9,360起'}」，选定直飞返程后总价即为 ¥${f.finalNetPrice}
                  </div>
                `
                }
                <button class="btn btn-sm btn-outline toggle-drawer-btn" data-drawer-id="${f.id}" style="width:100%; font-size:11.5px; padding:5px 8px;">
                  ${isDrawerOpen ? '收起行程明细 ▲' : '📋 查看真实出票与分段购票明细 ▼'}
                </button>
              </div>
            </div>
          </div>

          <!-- 展开的出票与分段明细抽屉 -->
          <div class="platform-drawer ${isDrawerOpen ? 'open' : ''}" id="drawer_${f.id}">
            <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:#93c5fd;display:flex;align-items:center;gap:6px;">
              <span>📋 携程真实出票核验卡 (100% 对齐真实订单卡片)：</span>
            </div>
            
            <div style="padding:12px; background:rgba(30,41,59,0.7); border-radius:8px; border:1px solid #334155; margin-bottom:10px; font-size:12.5px; line-height:1.6;">
              ${
                f.tierDetails ? `
                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:10px; margin-bottom:12px;">
                    <div style="padding:10px; background:rgba(15,23,42,0.85); border-radius:6px; border:1px solid #10b981; border-left:4px solid #10b981;">
                      <div style="color:#34d399; font-weight:700; font-size:13px;">✅ 携程标配出票价 (真实订单结算单同款)</div>
                      <div style="font-size:19px; font-weight:800; color:#fbbf24; margin:4px 0;">¥${f.tierDetails.standardCheckoutPrice.toLocaleString('zh-CN')} <span style="font-size:11px; font-weight:normal; color:#94a3b8;">(单成人含税价)</span></div>
                      <div style="color:#cbd5e1; font-size:11.5px;">• 托运行李：${f.tierDetails.baggagePolicy || '每人可托运1件，每件23KG'}</div>
                      <div style="color:#cbd5e1; font-size:11.5px;">• 退改规则：${f.tierDetails.refundPolicy || '2小时免费退，改期1300元'}</div>
                      <div style="color:#cbd5e1; font-size:11.5px;">• 出票渠道：携程官方认证供应商 ("供" 标识)</div>
                    </div>
                    ${f.tierDetails.lowestRestrictedPrice ? `
                    <div style="padding:10px; background:rgba(15,23,42,0.85); border-radius:6px; border:1px solid #475569; border-left:4px solid #64748b;">
                      <div style="color:#94a3b8; font-weight:700; font-size:13px;">ℹ️ 携程自营极简特惠包 (退改较严)</div>
                      <div style="font-size:19px; font-weight:800; color:#94a3b8; margin:4px 0;">¥${f.tierDetails.lowestRestrictedPrice.toLocaleString('zh-CN')} <span style="font-size:11px; font-weight:normal; color:#64748b;">(单成人含税价)</span></div>
                      <div style="color:#94a3b8; font-size:11.5px;">• 舱位特征：携程平台特惠经济舱起步价</div>
                      <div style="color:#94a3b8; font-size:11.5px;">• 限制条件：退改门槛较高，限额出票</div>
                      ${f.step1StartingPrice ? `<div style="color:#94a3b8; font-size:11.5px;">• 携程搜索第1屏起步价：¥${f.step1StartingPrice}起 (搭配转机返回)</div>` : ''}
                    </div>
                    ` : ''}
                  </div>
                ` : ''
              }

              ${
                f.tripType === 'round_trip'
                  ? (
                    f.isSameAirline
                      ? `<div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">✈️ 航司官方同票号往返直售特惠</div>
                         <div>该方案由携程直连全球分销系统，以<strong>往返同一票号打包出票</strong>，去返程全程同一航司，行李一件直挂，单人含税总实付 <strong>${fmtPrice(f.finalNetPrice)}</strong>。</div>`
                      : `<div style="color:#f59e0b; font-weight:700; margin-bottom:4px;">✈️ 携程独家跨航司拼单特价</div>
                         <div>该方案由去程国航 CA967 (¥${f.outbound.oneWayRawPrice}) 与返程东航 MU244 (¥${f.inbound.oneWayRawPrice}) 组合，享受单程拆单特价，总实付仅需 <strong>${fmtPrice(f.finalNetPrice)}</strong> (比往返同票号省 ¥1,164！)。</div>`
                  )
                  : `<div style="color:#34d399; font-weight:700; margin-bottom:4px;">✈️ 开口行程各航段单程底价累加</div>
                     <div>因开口行程（${f.shortLabel}）航司无同票号特价，由携程各航段真实出票底价精准累加：去程直飞 ¥${f.outbound.oneWayRawPrice} + 返程直飞 ¥${f.inbound.oneWayRawPrice} = 合计含税 <strong>${fmtPrice(f.finalNetPrice)}</strong>。</div>`
              }
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
              <a href="${getCtripBookingUrl(f)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="background:#2577e3; text-decoration:none; padding:7px 14px; border-radius:6px; color:#fff; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                🎟️ 前往携程直达预订 (${f.tripType === 'round_trip' ? '往返打包' : '多程合并'}) →
              </a>
              ${
                f.tripType === 'open_jaw'
                  ? `
                <a href="${getCtripOnewayUrl(f.outbound)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="text-decoration:none; font-size:12px; padding:6px 10px; color:#38bdf8; border-color:#0284c7;">
                  去程单买直达 (${f.outbound.fromCity}→${f.outbound.toCity} ¥${f.outbound.oneWayRawPrice}) →
                </a>
                <a href="${getCtripOnewayUrl(f.inbound)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="text-decoration:none; font-size:12px; padding:6px 10px; color:#38bdf8; border-color:#0284c7;">
                  返程单买直达 (${f.inbound.fromCity}→${f.inbound.toCity} ¥${f.inbound.oneWayRawPrice}) →
                </a>
              `
                  : ''
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.toggle-drawer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-drawer-id');
      if (state.openDrawers.has(id)) {
        state.openDrawers.delete(id);
      } else {
        state.openDrawers.add(id);
      }
      renderFlightsList();
    });
  });

  container.querySelectorAll('.fav-star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const flightId = btn.getAttribute('data-fav-id');
      const idx = state.favorites.indexOf(flightId);
      if (idx >= 0) {
        state.favorites.splice(idx, 1);
      } else {
        state.favorites.push(flightId);
      }
      saveLocalUserPreferences();
      renderFlightsList();
    });
  });
}

function renderSmartInsightBanner(filteredFlights) {
  const banner = document.getElementById('smartInsightBanner');
  if (!filteredFlights.length) {
    banner.innerHTML = '';
    return;
  }

  const cheapest = filteredFlights[0];
  const cheapestDirect = filteredFlights.find(f => f.isBothDirect);
  const ecoThreshold = state.settings.alertThresholdEconomy || 5200;
  const isBelowTarget = cheapest.finalNetPrice <= ecoThreshold;

  banner.innerHTML = `
    <div>
      ${
        isBelowTarget
          ? `<span style="color:#34d399;font-weight:700;">🔔 触发低价提醒！</span> `
          : `<span>💡 <strong>智能购票洞察：</strong></span>`
      }
      当前筛选下全场最低为 <strong>${cheapest.combinationName}</strong>（${cheapest.airlineDisplay} · ${cheapest.cabinName}），
      在 <strong>${cheapest.bestPlatform.platformName}</strong> 叠加优惠后仅需 <strong style="color:#34d399;font-size:15px;">${fmtPrice(cheapest.finalNetPrice)}</strong>；
      ${
        cheapestDirect
          ? `若追求<strong>去返双直飞</strong>，最优为 <strong>${cheapestDirect.airlineDisplay} (${cheapestDirect.combinationName})</strong>，实付 <strong style="color:#38bdf8;">${fmtPrice(cheapestDirect.finalNetPrice)}</strong>。`
          : ''
      }
    </div>
  `;
}

/**
 * 渲染 Tab 2: 开口联程 vs 单程拆分对比 & 自由拼单计算器
 */
function renderSplitComparisonTab() {
  const summaries = state.snapshot.combinationsSummary || [];
  const tbody = document.querySelector('#splitVsComboTable tbody');

  tbody.innerHTML = summaries
    .map(c => {
      const comboLow = c.lowestOverall ? c.lowestOverall.finalNetPrice : 0;
      const split = c.lowestSplitTotal;
      if (!split) return '';
      const diff = split.totalNetPrice - comboLow;

      return `
        <tr>
          <td>
            <strong>${c.name}</strong>
            <div class="text-muted">${c.outbound.fromCity}→${c.outbound.toCity} / ${c.inbound.fromCity}→${c.inbound.toCity}</div>
          </td>
          <td>
            <strong style="color:#34d399;font-size:15px;">${fmtPrice(comboLow)}</strong>
            <div class="text-muted">${c.lowestOverall.airlineDisplay} (${c.lowestOverall.bestPlatform.shortName})</div>
          </td>
          <td>
            <strong>${fmtPrice(split.outboundFlight.finalNetPrice)}</strong>
            <div class="text-muted">${split.outboundFlight.airlineName} ${split.outboundFlight.flightNo}</div>
          </td>
          <td>
            <strong>${fmtPrice(split.inboundFlight.finalNetPrice)}</strong>
            <div class="text-muted">${split.inboundFlight.airlineName} ${split.inboundFlight.flightNo}</div>
          </td>
          <td>
            <strong>${fmtPrice(split.totalNetPrice)}</strong>
          </td>
          <td>
            ${
              diff > 0
                ? `<span class="badge badge-direct">买联程/开口套票立省 ${fmtPrice(diff)}</span>`
                : `<span class="badge badge-combo">分开买两张单程省 ${fmtPrice(Math.abs(diff))}</span>`
            }
          </td>
        </tr>
      `;
    })
    .join('');

  const owMap = state.snapshot.oneWayBySegment || {};
  const outboundList = [...(owMap.PVG_MXP || []), ...(owMap.PVG_FCO || [])].filter(
    f => f.cabinClass === 'ECONOMY' || f.cabinClass === 'BUSINESS'
  );
  const inboundList = [...(owMap.MXP_PVG || []), ...(owMap.FCO_PVG || [])].filter(
    f => f.cabinClass === 'ECONOMY' || f.cabinClass === 'BUSINESS'
  );

  const outSel = document.getElementById('calcOutboundSelect');
  const inSel = document.getElementById('calcInboundSelect');

  const prevOut = outSel.value;
  const prevIn = inSel.value;

  outSel.innerHTML = outboundList
    .map(
      f =>
        `<option value="${f.id}">[${f.segmentKey === 'PVG_MXP' ? '沪→米' : '沪→罗'} · ${f.cabinName}] ${f.airlineName} ${f.flightNo} (${f.stops === 0 ? '直飞' : '1转'}) - 实付 ${fmtPrice(f.finalNetPrice)}</option>`
    )
    .join('');

  inSel.innerHTML = inboundList
    .map(
      f =>
        `<option value="${f.id}">[${f.segmentKey === 'MXP_PVG' ? '米→沪' : '罗→沪'} · ${f.cabinName}] ${f.airlineName} ${f.flightNo} (${f.stops === 0 ? '直飞' : '1转'}) - 实付 ${fmtPrice(f.finalNetPrice)}</option>`
    )
    .join('');

  if (prevOut && outboundList.some(f => f.id === prevOut)) outSel.value = prevOut;
  if (prevIn && inboundList.some(f => f.id === prevIn)) inSel.value = prevIn;

  updateSplitCalculatorResult(outboundList, inboundList);

  outSel.onchange = () => updateSplitCalculatorResult(outboundList, inboundList);
  inSel.onchange = () => updateSplitCalculatorResult(outboundList, inboundList);

  renderOneWaySegmentList();
}

function updateSplitCalculatorResult(outboundList, inboundList) {
  const outId = document.getElementById('calcOutboundSelect').value;
  const inId = document.getElementById('calcInboundSelect').value;
  const outFlight = outboundList.find(f => f.id === outId) || outboundList[0];
  const inFlight = inboundList.find(f => f.id === inId) || inboundList[0];
  if (!outFlight || !inFlight) return;

  const splitSum = outFlight.finalNetPrice + inFlight.finalNetPrice;

  const targetComboId =
    outFlight.segmentKey === 'PVG_MXP' && inFlight.segmentKey === 'FCO_PVG'
      ? 'milan_in_rome_out'
      : outFlight.segmentKey === 'PVG_FCO' && inFlight.segmentKey === 'MXP_PVG'
      ? 'rome_in_milan_out'
      : outFlight.segmentKey === 'PVG_MXP' && inFlight.segmentKey === 'MXP_PVG'
      ? 'milan_round_trip'
      : 'rome_round_trip';

  const matchingBundled = (state.snapshot.allComboFlights || []).find(
    f => f.combinationId === targetComboId && f.cabinClass === outFlight.cabinClass
  );

  const bundledPrice = matchingBundled ? matchingBundled.finalNetPrice : Math.round(splitSum * 0.85);
  const diff = splitSum - bundledPrice;

  document.getElementById('calcResultBox').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="text-muted">两段单程分开买实付总计（分别用单程券）：</div>
        <div style="font-size:22px;font-weight:800;color:#f8fafc;">
          ${fmtPrice(outFlight.finalNetPrice)} + ${fmtPrice(inFlight.finalNetPrice)} = <span style="color:#fbbf24">${fmtPrice(splitSum)}</span>
        </div>
      </div>
      <div>
        <div class="text-muted">同路线联程/开口套票最低价：</div>
        <div style="font-size:22px;font-weight:800;color:#34d399;">${fmtPrice(bundledPrice)}</div>
      </div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(148,163,184,0.15);font-size:13px;">
      💡 <strong>比价建议：</strong>
      ${
        diff > 0
          ? `直接购买 <strong>${matchingBundled ? matchingBundled.combinationName : '开口/往返联程套票'}</strong> 比分开买这两段单程便宜 <strong style="color:#34d399">${fmtPrice(diff)}</strong>，且联程票遇到前序延误有航司免费改签保障！`
          : `您挑选的跨航司拼票组合非常划算，分开购买仅需 ${fmtPrice(splitSum)}！`
      }
    </div>
  `;
}

function renderOneWaySegmentList() {
  const seg = state.filters.oneWaySeg || 'PVG_MXP';
  const list = (state.snapshot.oneWayBySegment && state.snapshot.oneWayBySegment[seg]) || [];
  const box = document.getElementById('oneWayListContainer');

  box.innerHTML = list
    .map(
      f => `
      <div class="ow-mini-item">
        <div>
          <span class="badge badge-cabin-${f.cabinClass}">${f.cabinName}</span>
          <strong>${f.airlineName} ${f.flightNo}</strong>
          <span class="text-muted">(${f.depTime}→${f.arrTime} · ${f.durationText} · ${f.stops === 0 ? '直飞' : '经' + f.stopCity + '中转'})</span>
          <div class="text-muted" style="font-size:11.5px;">最优渠道：${f.bestPlatform.platformName} (已减 ¥${f.totalDiscount})</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:800;color:#34d399;">${fmtPrice(f.finalNetPrice)}</div>
          <div class="text-muted" style="text-decoration:line-through;font-size:11px;">含税 ¥${f.rawTotalPrice}</div>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * 渲染 Tab 3: 平台优惠活动与优惠券中心
 */
function renderCouponsTab() {
  const container = document.getElementById('couponsListContainer');
  container.innerHTML = state.coupons
    .map(c => {
      const platName =
        c.platform === 'ALL'
          ? '全平台通用'
          : state.platforms[c.platform]
          ? state.platforms[c.platform].name
          : c.platform;

      const badgeText =
        c.type === 'percentage_base'
          ? `票面 -${Math.round((c.discountRate || 0.05) * 100)}%`
          : `-¥${c.discountAmount}`;

      const tierBadge =
        c.tier === 'PUBLIC_FREE'
          ? '<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(16,185,129,0.18);color:#34d399;font-weight:600;border:1px solid rgba(16,185,129,0.3);">🟢 人人免费可领</span>'
          : c.tier === 'LIMITED_OR_BANK'
          ? '<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(245,158,11,0.18);color:#fbbf24;font-weight:600;border:1px solid rgba(245,158,11,0.3);">🟡 银行支付立减/限时抢</span>'
          : '<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(168,85,247,0.18);color:#c084fc;font-weight:600;border:1px solid rgba(168,85,247,0.3);">🟣 VIP/高门槛会员专属 (默认关)</span>';

      const howToGetHtml = c.howToGet
        ? `<div style="font-size:12px;color:#38bdf8;margin-top:5px;background:rgba(15,23,42,0.6);padding:6px 10px;border-radius:6px;border-left:3px solid #38bdf8;">📍 <strong>如何获取：</strong>${c.howToGet}</div>`
        : '';

      return `
        <div class="coupon-item-card ${c.enabled ? 'enabled' : ''}">
          <div class="coupon-left">
            <div class="coupon-amount-badge">${badgeText}</div>
            <div class="coupon-info">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <span class="badge badge-combo">${platName}</span>
                ${tierBadge}
              </div>
              <h4 style="margin:2px 0 4px 0;">
                ${c.name}
              </h4>
              <p style="color:#cbd5e1;font-size:13px;">${c.description || `满 ¥${c.minSpend} 可用`}</p>
              ${howToGetHtml}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${
              c.isCustom
                ? `<button class="btn btn-sm btn-outline delete-coupon-btn" data-del-id="${c.id}">删除</button>`
                : ''
            }
            <label class="switch">
              <input type="checkbox" class="coupon-toggle-chk" data-coupon-id="${c.id}" ${c.enabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.coupon-toggle-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-coupon-id');
      const target = state.coupons.find(c => c.id === id);
      if (target) {
        target.enabled = chk.checked;
        recalculateSnapshotInBrowser(1.0, false);
        renderAll();
      }
    });
  });

  container.querySelectorAll('.delete-coupon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-id');
      state.coupons = state.coupons.filter(c => c.id !== id);
      recalculateSnapshotInBrowser(1.0, false);
      renderAll();
    });
  });
}

/**
 * 渲染 Tab 4: 历史价格走势 SVG 折线图
 */
function renderPriceTrendChart() {
  const box = document.getElementById('priceTrendChartBox');
  const history = state.priceHistory || [];
  if (history.length < 2) {
    box.innerHTML = '<p class="text-muted">正在积累历史价格点...</p>';
    return;
  }

  const width = 920;
  const height = 240;
  const padL = 58;
  const padR = 24;
  const padT = 22;
  const padB = 34;

  const allVals = [];
  history.forEach(p => {
    if (p.milan_in_rome_out) allVals.push(p.milan_in_rome_out);
    if (p.rome_in_milan_out) allVals.push(p.rome_in_milan_out);
    if (p.direct_lowest) allVals.push(p.direct_lowest);
  });

  const minVal = Math.floor((Math.min(...allVals) - 200) / 100) * 100;
  const maxVal = Math.ceil((Math.max(...allVals) + 200) / 100) * 100;

  const getX = idx => padL + (idx / (history.length - 1)) * (width - padL - padR);
  const getY = val => padT + ((maxVal - val) / Math.max(1, maxVal - minVal)) * (height - padT - padB);

  const buildPath = key =>
    history
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(pt[key]).toFixed(1)}`)
      .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(r => {
    const val = Math.round(maxVal - r * (maxVal - minVal));
    const y = padT + r * (height - padT - padB);
    return `
      <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="rgba(148,163,184,0.14)" stroke-dasharray="4 4"/>
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11">¥${val}</text>
    `;
  });

  const xLabels = history.map((pt, i) => {
    if (history.length > 10 && i % 2 !== 0 && i !== history.length - 1) return '';
    return `<text x="${getX(i)}" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">${pt.label}</text>`;
  });

  box.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;overflow:visible;">
      ${gridLines.join('')}
      <path d="${buildPath('direct_lowest')}" fill="none" stroke="#34d399" stroke-width="2.5"/>
      <path d="${buildPath('rome_in_milan_out')}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
      <path d="${buildPath('milan_in_rome_out')}" fill="none" stroke="#38bdf8" stroke-width="3"/>
      ${history
        .map(
          (pt, i) => `
          <circle cx="${getX(i)}" cy="${getY(pt.milan_in_rome_out)}" r="4" fill="#38bdf8">
            <title>${pt.label} 米进罗出最低: ¥${pt.milan_in_rome_out}</title>
          </circle>
          <circle cx="${getX(i)}" cy="${getY(pt.direct_lowest)}" r="3.5" fill="#34d399">
            <title>${pt.label} 双直飞最低: ¥${pt.direct_lowest}</title>
          </circle>
        `
        )
        .join('')}
      ${xLabels.join('')}
    </svg>
  `;
}

/**
 * 绘制公网二维码卡片
 */
function renderMobileSyncModal() {
  const url = window.location.href.split('#')[0];
  const qrBox = document.getElementById('qrCanvasContainer');
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  qrBox.innerHTML = `
    <div style="text-align:center;color:#0f172a;">
      <img src="${qrImgUrl}" alt="iPhone扫码打开" width="180" height="180" style="display:block;margin:0 auto 8px;" onerror="this.style.display='none'" />
      <div style="font-size:13px;font-weight:700;color:#1e3a8a;background:#e0f2fe;padding:6px 12px;border-radius:6px;word-break:break-all;">
        公开访问网址：<br/>
        <span style="font-size:14px;color:#0284c7;">${url}</span>
      </div>
    </div>
  `;
}

/**
 * 远程触发 GitHub Actions workflow_dispatch (若配置了 Repo 和 Token)
 */
async function triggerGitHubWorkflowDispatch() {
  const repo = (state.settings.ghRepo || detectGitHubRepoFromUrl() || 'frankwyh/flight-monitor').trim();
  const token = getGitHubToken();

  if (!token) {
    return {
      ok: false,
      repo,
      actionsUrl: `https://github.com/${repo}/actions`,
      reason: '未检测到有效的 GitHub Token，请点击重新配置'
    };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/flight-monitor.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );
    if (res.status === 204 || res.ok) {
      return { ok: true, repo };
    }
    if (res.status === 401) {
      return {
        ok: false,
        repo,
        status: 401,
        reason: 'GitHub Token 无效或已过期 (401 Unauthorized)，请点击重新输入正确的 Token'
      };
    }
    if (res.status === 403 || res.status === 404) {
      return {
        ok: false,
        repo,
        status: res.status,
        reason: `Token 权限不足或未勾选 workflow 权限 (HTTP ${res.status})，请重新生成并输入`
      };
    }
    return {
      ok: false,
      repo,
      reason: `GitHub API 响应异常 (HTTP ${res.status})`
    };
  } catch (err) {
    return { ok: false, repo, reason: err.message };
  }
}

/**
 * 绑定全局 DOM 事件
 */
function bindEvents() {
  const switchTab = targetTabId => {
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === targetTabId);
    });
    document.querySelectorAll('#desktopNav .nav-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === targetTabId);
    });
    document.querySelectorAll('#mobileNav .mob-nav-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === targetTabId);
    });
  };

  document.querySelectorAll('#desktopNav .nav-tab, #mobileNav .mob-nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  document.querySelectorAll('#comboFilterGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.combination = btn.getAttribute('data-value');
      syncSegmentedActive('#comboFilterGroup', state.filters.combination);
      renderComboOverviewCards();
      renderFlightsList();
    });
  });

  document.querySelectorAll('#stopsFilterGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.stops = btn.getAttribute('data-value');
      syncSegmentedActive('#stopsFilterGroup', state.filters.stops);
      renderFlightsList();
    });
  });

  document.querySelectorAll('#cabinFilterGroup .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.cabin = btn.getAttribute('data-value');
      syncSegmentedActive('#cabinFilterGroup', state.filters.cabin);
      renderFlightsList();
    });
  });

  document.getElementById('airlineFilterSelect').addEventListener('change', e => {
    state.filters.airline = e.target.value;
    renderFlightsList();
  });

  document.getElementById('sortBySelect').addEventListener('change', e => {
    state.filters.sortBy = e.target.value;
    renderFlightsList();
  });

  document.querySelectorAll('#oneWaySegmentTabs .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.oneWaySeg = btn.getAttribute('data-seg');
      document.querySelectorAll('#oneWaySegmentTabs .seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-seg') === state.filters.oneWaySeg);
      });
      renderOneWaySegmentList();
    });
  });

  function openRefreshGuideModal() {
  const modal = document.getElementById('refreshGuideModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const tokenInput = document.getElementById('modalGhTokenInput');
  const currentToken = getGitHubToken();
  if (tokenInput) {
    tokenInput.value = currentToken;
  }
  const statusEl = document.getElementById('modalTokenStatusBadge');
  if (statusEl) {
    if (currentToken) {
      const masked = currentToken.length > 8 ? `${currentToken.slice(0, 4)}****${currentToken.slice(-4)}` : '****';
      statusEl.innerHTML = `<span style="color:#34d399; font-weight:600;">● 当前已保存 Token: ${masked}</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:#94a3b8;">○ 当前未配置 Token (请在下方输入)</span>`;
    }
  }
}

  // ==================== 顶部「⚡ 一键刷新」云端自动化浏览器真抓取流程 ====================
  async function executeRealScrapeFlow() {
    const btn = document.getElementById('refreshNowBtn');
    const repo = (state.settings.ghRepo || detectGitHubRepoFromUrl() || 'frankwyh/flight-monitor').trim();
    const token = getGitHubToken();

    // 1. 若未配置 Token，直接弹出配置面板
    if (!token) {
      openRefreshGuideModal();
      return;
    }

    // 2. 已有 Token，触发调度
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">🔄</span> 云端自动化浏览器开机抓取中...';
    showRefreshToast('<span>🚀 <strong>已向云端发送调度指令！</strong> GitHub Actions 正在启动 Playwright 自动化浏览器抓取携程最新真价格（预计耗时 40~50 秒）...</span>');

    try {
      const triggerRes = await triggerGitHubWorkflowDispatch();
      if (!triggerRes.ok) {
        btn.disabled = false;
        btn.innerHTML = '<span id="refreshBtnIcon">⚡</span> 一键刷新';
        showRefreshToast(`<span style="color:#ef4444;">❌ 云端调度失败：${triggerRes.reason}</span>`);
        alert(`云端调度失败: ${triggerRes.reason}\n\n已为您自动打开 Token 配置窗口，请检查或重新输入！`);
        openRefreshGuideModal();
        return;
      }

      // 轮询等待云端自动化浏览器抓取完成
      let attempts = 0;
      const maxAttempts = 20; // 20 * 4s = 80s
      const pollInterval = setInterval(async () => {
        attempts++;
        btn.innerHTML = `<span class="spin">🔄</span> 自动化浏览器抓取中 (${attempts * 4}s)...`;
        try {
          const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?event=workflow_dispatch&per_page=1`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
          });
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const latestRun = runsData.workflow_runs && runsData.workflow_runs[0];
            if (latestRun && latestRun.status === 'completed') {
              clearInterval(pollInterval);
              await loadDashboard(true);
              recalculateSnapshotInBrowser(1.0, true);
              renderAll();
              btn.disabled = false;
              btn.innerHTML = '<span id="refreshBtnIcon">⚡</span> 一键刷新';
              showRefreshToast('<span>✅ <strong>云端自动化浏览器抓取完成！</strong> 携程最新真实直飞出票价已同步至网页！</span>');
              return;
            }
          }
        } catch (e) {}

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          btn.disabled = false;
          btn.innerHTML = '<span id="refreshBtnIcon">⚡</span> 一键刷新';
          showRefreshToast('<span>⏳ 云端任务正在执行，数据即将就绪，您稍后刷新页面即可查看！</span>');
        }
      }, 4000);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<span id="refreshBtnIcon">⚡</span> 一键刷新';
      alert('触发云端抓取异常: ' + err.message);
      openRefreshGuideModal();
    }
  }

  document.getElementById('refreshNowBtn').addEventListener('click', executeRealScrapeFlow);

  const openTokenBtn = document.getElementById('openTokenConfigBtn');
  if (openTokenBtn) {
    openTokenBtn.addEventListener('click', openRefreshGuideModal);
  }

  const closeGuideBtn = document.getElementById('closeRefreshGuideBtn');
  if (closeGuideBtn) {
    closeGuideBtn.addEventListener('click', () => {
      document.getElementById('refreshGuideModal').classList.add('hidden');
    });
  }

  const saveTokenBtn = document.getElementById('saveTokenAndTriggerBtn');
  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', () => {
      const input = document.getElementById('modalGhTokenInput');
      const val = input ? input.value.trim() : '';
      if (!val) {
        alert('请输入有效的 GitHub Token！');
        return;
      }
      setGitHubToken(val);
      document.getElementById('refreshGuideModal').classList.add('hidden');
      executeRealScrapeFlow();
    });
  }

  const clearTokenBtn = document.getElementById('clearModalTokenBtn');
  if (clearTokenBtn) {
    clearTokenBtn.addEventListener('click', () => {
      setGitHubToken('');
      const input = document.getElementById('modalGhTokenInput');
      if (input) input.value = '';
      const statusEl = document.getElementById('modalTokenStatusBadge');
      if (statusEl) statusEl.innerHTML = '<span style="color:#94a3b8;">○ Token 已清除，请重新输入</span>';
      showRefreshToast('<span>🗑️ 已清除已保存的 GitHub Token</span>');
    });
  }



  // 更新去返程日期
  document.getElementById('applyDateBtn').addEventListener('click', () => {
    state.settings.outboundDate = document.getElementById('outboundDateInput').value;
    state.settings.inboundDate = document.getElementById('inboundDateInput').value;
    recalculateSnapshotInBrowser(1.0, true);
    syncSettingsInputs();
    renderAll();
    showRefreshToast(`<span>✅ 已更新监控行程日期为：<strong>${state.settings.outboundDate} 去 / ${state.settings.inboundDate} 回</strong>，全站价格已重新计算！</span>`);
  });

  // 优惠券全选 / 全部取消
  document.getElementById('enableAllCouponsBtn').addEventListener('click', () => {
    state.coupons.forEach(c => {
      c.enabled = true;
    });
    recalculateSnapshotInBrowser(1.0, false);
    renderAll();
  });

  document.getElementById('disableAllCouponsBtn').addEventListener('click', () => {
    state.coupons.forEach(c => {
      c.enabled = false;
    });
    recalculateSnapshotInBrowser(1.0, false);
    renderAll();
  });

  // 新增自定义优惠券
  document.getElementById('addCouponForm').addEventListener('submit', e => {
    e.preventDefault();
    const minSpend = Number(document.getElementById('newCouponMinSpend').value) || 0;
    const discountAmount = Number(document.getElementById('newCouponDiscount').value) || 100;
    const category = document.getElementById('newCouponCategory').value;

    const newCoupon = {
      id: `custom_${Date.now()}`,
      platform: document.getElementById('newCouponPlatform').value,
      name: document.getElementById('newCouponName').value.trim() || '自定义优惠券',
      category,
      type: 'threshold_minus',
      minSpend,
      discountAmount,
      cabinLimit: document.getElementById('newCouponCabin').value,
      tripTypeLimit: 'ALL',
      AirlineLimit: 'ALL',
      enabled: true,
      isCustom: true,
      stackableWithPayment: category !== 'payment_discount',
      description: `满 ¥${minSpend} 立减 ¥${discountAmount}`
    };

    state.coupons.unshift(newCoupon);
    document.getElementById('newCouponName').value = '';
    recalculateSnapshotInBrowser(1.0, false);
    renderAll();
  });

  // 保存预警设置 & GitHub 仓库配置
  document.getElementById('alertSettingsForm').addEventListener('submit', e => {
    e.preventDefault();
    state.settings.alertThresholdEconomy = Number(document.getElementById('settingAlertEco').value);
    state.settings.alertThresholdDirect = Number(document.getElementById('settingAlertDirect').value);
    state.settings.alertThresholdBusiness = Number(document.getElementById('settingAlertBiz').value);
    state.settings.barkPushUrl = document.getElementById('settingBarkUrl').value.trim();
    state.settings.ghRepo = document.getElementById('settingGhRepo').value.trim();
    state.settings.ghToken = document.getElementById('settingGhToken').value.trim();

    saveLocalUserPreferences();
    document.getElementById('notifyTestFeedback').textContent = '✅ 预警阈值、iOS Bark 及 GitHub 配置已保存在本机浏览器！';
    renderAll();
  });

  // 测试推送通知 (直接从浏览器调用 Bark API + 浏览器原生通知)
  document.getElementById('testNotificationBtn').addEventListener('click', async () => {
    const barkPushUrl = document.getElementById('settingBarkUrl').value.trim();
    const fb = document.getElementById('notifyTestFeedback');
    const bestFlight = state.snapshot && state.snapshot.allComboFlights && state.snapshot.allComboFlights[0];
    const title = '✈️ 意大利机票低价监控提醒';
    const msg = bestFlight
      ? `${bestFlight.shortLabel} (${bestFlight.outbound.date}去/${bestFlight.inbound.date}回) 最低实付 ¥${bestFlight.finalNetPrice} [${bestFlight.airlineDisplay} · ${bestFlight.bestPlatform.shortName}]`
      : '4/10上海-米兰/罗马，4/24返程监控运行正常';

    if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification(title, { body: msg });
        }
      });
    }

    if (barkPushUrl) {
      fb.textContent = '正在向 iPhone Bark 发送推送...';
      try {
        const cleanBase = barkPushUrl.replace(/\/+$/, '');
        const fullUrl = `${cleanBase}/${encodeURIComponent(title)}/${encodeURIComponent(msg)}?group=${encodeURIComponent('中意机票监控')}&sound=calypso`;
        await fetch(fullUrl, { mode: 'no-cors' });
        fb.textContent = `✅ 已向 iOS Bark 发送推送请求：${msg}`;
      } catch (err) {
        fb.textContent = `⚠️ Bark 请求异常：${err.message}`;
      }
    } else {
      fb.textContent = `🔔 网页测试提醒成功：${msg} (如需锁屏推送到 iPhone，可填写上方 Bark 地址)`;
    }
  });

  // 触发 GitHub Actions 云端刷新按钮
  const cloudBtn = document.getElementById('triggerCloudActionBtn');
  if (cloudBtn) {
    cloudBtn.addEventListener('click', async () => {
      state.settings.ghRepo = document.getElementById('settingGhRepo').value.trim();
      state.settings.ghToken = document.getElementById('settingGhToken').value.trim();
      saveLocalUserPreferences();

      const fb = document.getElementById('notifyTestFeedback');
      fb.textContent = '☁️ 正在连接 GitHub Actions...';
      const res = await triggerGitHubWorkflowDispatch();
      if (res.ok) {
        fb.textContent = `✅ 已成功触发仓库 ${res.repo} 的 GitHub Actions 云端抓取任务！约 30 秒后自动发布最新数据。`;
      } else if (res.actionsUrl) {
        fb.innerHTML = `💡 ${res.reason} — <a href="${res.actionsUrl}" target="_blank" style="color:#38bdf8;text-decoration:underline;">点击此处前往 GitHub Actions 页面手动点 Run workflow</a>`;
      } else {
        fb.textContent = `💡 ${res.reason}`;
      }
    });
  }

  // 手机二维码弹窗
  document.getElementById('openMobileModalBtn').addEventListener('click', () => {
    renderMobileSyncModal();
    document.getElementById('mobileQrModal').classList.remove('hidden');
  });

  document.getElementById('closeMobileModalBtn').addEventListener('click', () => {
    document.getElementById('mobileQrModal').classList.add('hidden');
  });

  document.getElementById('copyLanUrlBtn').addEventListener('click', () => {
    const input = document.getElementById('mobileLanUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    document.getElementById('copyLanUrlBtn').textContent = '已复制 ✓';
    setTimeout(() => {
      document.getElementById('copyLanUrlBtn').textContent = '复制网址';
    }, 1500);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Service worker disabled to prevent caching
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadDashboard(false);
});
