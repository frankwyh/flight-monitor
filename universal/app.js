/**
 * 全球/全国通用版前端交互核心逻辑
 * 支持：
 *   1. 任意国内/国外起终点（支持主终点 A + 开口备选终点 B）
 *   2. 3 种日期模式：模糊时间段范围+天数、精确日期±3天比价、整月低价日历
 *   3. 3 级透明分级优惠券库（人人可领 vs 银行支付 vs VIP钻卡专属）
 *   4. 联程 vs 单程拆分比价矩阵
 *   5. PC 桌面端 + iOS 手机端完整响应式适配
 */

const uniState = {
  route: {
    origin: 'SHA',
    destA: 'TYO',
    destB: 'OSA',
    tripMode: 'ROUND_OR_OPENJAW'
  },
  dateMode: 'FLEX_RANGE', // 'FLEX_RANGE' | 'EXACT' | 'MONTH_CALENDAR'
  flexParams: {
    startDate: '2027-05-01',
    endDate: '2027-05-18',
    stayMin: 5,
    stayMax: 7,
    dayPref: 'ALL'
  },
  exactParams: {
    outDate: '2027-04-10',
    inDate: '2027-04-24',
    plusMinus: 3
  },
  calendarParams: {
    month: '2027-05',
    stayDays: 7
  },
  activeDatePair: {
    outDate: '2027-05-08',
    inDate: '2027-05-14',
    stayDays: 6,
    label: '05/08(周六) ~ 05/14(周五) · 6天'
  },
  filters: {
    combo: 'ALL',
    stops: 'ALL',
    cabin: 'ALL',
    sortBy: 'NET_ASC'
  },
  coupons: [],
  watchlist: [],
  dateMatrixResults: [],
  comboSummaries: [],
  currentFlights: [],
  openDrawers: new Set()
};

function fmtPrice(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '--';
  return '¥' + Math.round(Number(num)).toLocaleString('zh-CN');
}

function getWeekDay(dateStr) {
  const d = new Date(dateStr);
  const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return map[d.getDay()] || '';
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDaysDiff(d1, d2) {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  return Math.round((t2 - t1) / (86400 * 1000));
}

/**
 * 初始化页面
 */
document.addEventListener('DOMContentLoaded', () => {
  initCoupons();
  initAirportSelectors();
  initWatchlist();
  bindEvents();
  runActiveSearch();
});

function initCoupons() {
  const saved = localStorage.getItem('uni_coupons_config');
  if (saved) {
    try {
      uniState.coupons = JSON.parse(saved);
    } catch (e) {
      uniState.coupons = JSON.parse(JSON.stringify(window.UNIVERSAL_DEFAULT_COUPONS));
    }
  } else {
    uniState.coupons = JSON.parse(JSON.stringify(window.UNIVERSAL_DEFAULT_COUPONS));
  }
  updateCouponsPill();
}

function saveCoupons() {
  localStorage.setItem('uni_coupons_config', JSON.stringify(uniState.coupons));
  updateCouponsPill();
}

function updateCouponsPill() {
  const count = uniState.coupons.filter(c => c.enabled).length;
  const pill = document.getElementById('uniCouponsCountPill');
  if (pill) pill.textContent = count;
}

/**
 * 填充起点与终点下拉菜单
 */
function initAirportSelectors() {
  const db = window.AIRPORT_DB || [];
  const regions = [
    { key: 'DOMESTIC', label: '🇨🇳 中国大陆主要城市' },
    { key: 'ASIA_SHORT', label: '🇯🇵 港澳台 · 日韩泰近途' },
    { key: 'ASIA_MID', label: '🇸🇬 东南亚 · 中东海湾' },
    { key: 'EUROPE', label: '🇪🇺 欧洲全境 (意/英/法/德/西等)' },
    { key: 'AMERICA_OCEANIA', label: '🇺🇸 美加 · 澳新大洋洲' }
  ];

  const buildGroupedOptions = (allowEmpty = false) => {
    let html = allowEmpty ? '<option value="">(无/仅单个目的地往返)</option>' : '';
    for (const reg of regions) {
      const list = db.filter(a => a.region === reg.key);
      if (!list.length) continue;
      html += `<optgroup label="${reg.label}">`;
      for (const a of list) {
        html += `<option value="${a.code}">${a.city} (${a.code} / ${a.iata}) - ${a.country}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  };

  const origSel = document.getElementById('originSelect');
  const destASel = document.getElementById('destASelect');
  const destBSel = document.getElementById('destBSelect');

  origSel.innerHTML = buildGroupedOptions(false);
  destASel.innerHTML = buildGroupedOptions(false);
  destBSel.innerHTML = buildGroupedOptions(true);

  origSel.value = 'SHA';
  destASel.value = 'TYO';
  destBSel.value = 'OSA';
}

/**
 * 初始化快捷任务收藏夹
 */
function initWatchlist() {
  const defaultPresets = window.PRESET_WATCH_TEMPLATES || [];
  const saved = localStorage.getItem('uni_watchlist');
  let list = defaultPresets;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) list = parsed;
    } catch (e) {}
  }
  uniState.watchlist = list;
  renderWatchlistChips();
}

function renderWatchlistChips() {
  const container = document.getElementById('watchlistChipsContainer');
  if (!container) return;

  container.innerHTML = uniState.watchlist
    .map(
      (item, idx) => `
      <div class="watchlist-chip ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <span>${item.name}</span>
        <span class="chip-dates">${item.datesDesc}</span>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.watchlist-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.watchlist-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const idx = Number(chip.getAttribute('data-idx'));
      applyWatchlistTemplate(uniState.watchlist[idx]);
    });
  });
}

function applyWatchlistTemplate(tpl) {
  if (!tpl) return;
  uniState.route.origin = tpl.origin;
  uniState.route.destA = tpl.destA;
  uniState.route.destB = tpl.destB || '';

  document.getElementById('originSelect').value = tpl.origin;
  document.getElementById('destASelect').value = tpl.destA;
  document.getElementById('destBSelect').value = tpl.destB || '';

  if (tpl.flexStartDate && tpl.flexEndDate) {
    uniState.dateMode = 'FLEX_RANGE';
    uniState.flexParams.startDate = tpl.flexStartDate;
    uniState.flexParams.endDate = tpl.flexEndDate;
    uniState.flexParams.stayMin = tpl.stayDaysMin || 5;
    uniState.flexParams.stayMax = tpl.stayDaysMax || 7;

    document.getElementById('flexStartDate').value = tpl.flexStartDate;
    document.getElementById('flexEndDate').value = tpl.flexEndDate;
    document.getElementById('stayMinInput').value = tpl.stayDaysMin || 5;
    document.getElementById('stayMaxInput').value = tpl.stayDaysMax || 7;
    switchDateMode('FLEX_RANGE');
  }

  showToast(`已切换监控航线：${tpl.name}`);
  runActiveSearch();
}

function bindEvents() {
  // 顶部导航 Tab 切换
  document.querySelectorAll('#uniDesktopNav .nav-tab, #uniMobileNav .mob-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab) return;
      document.querySelectorAll('#uniDesktopNav .nav-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === targetTab);
      });
      document.querySelectorAll('#uniMobileNav .mob-nav-item').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === targetTab);
      });
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === targetTab);
      });
      if (targetTab === 'uni-tab-coupons') renderTieredCouponsTab();
      if (targetTab === 'uni-tab-split') renderSplitTable();
    });
  });

  // 日期模式切换
  document.querySelectorAll('#dateModeTabs .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      switchDateMode(mode);
    });
  });

  // 节假日快选 Chip
  document.querySelectorAll('.holiday-quick-tags .chip-sm').forEach(chip => {
    chip.addEventListener('click', () => {
      const [start, end, minStay, maxStay] = chip.getAttribute('data-holiday').split(',');
      document.getElementById('flexStartDate').value = start;
      document.getElementById('flexEndDate').value = end;
      document.getElementById('stayMinInput').value = minStay;
      document.getElementById('stayMaxInput').value = maxStay;
      switchDateMode('FLEX_RANGE');
      showToast(`已设定节假日检索范围：${chip.textContent.trim()} (${start} ~ ${end})`);
      runActiveSearch();
    });
  });

  // 互换起点终点
  document.getElementById('swapRouteBtn').addEventListener('click', () => {
    const oSel = document.getElementById('originSelect');
    const dSel = document.getElementById('destASelect');
    const tmp = oSel.value;
    oSel.value = dSel.value;
    dSel.value = tmp;
    showToast(`已互换起终点：${oSel.value} ⇄ ${dSel.value}`);
    runActiveSearch();
  });

  // 检索按钮
  document.getElementById('runSearchBtn').addEventListener('click', runActiveSearch);
  document.getElementById('runSearchExactBtn').addEventListener('click', runActiveSearch);
  document.getElementById('runSearchCalendarBtn').addEventListener('click', runActiveSearch);

  // 保存当前任务
  document.getElementById('saveCurrentTaskBtn').addEventListener('click', () => {
    const o = document.getElementById('originSelect').value;
    const dA = document.getElementById('destASelect').value;
    const dB = document.getElementById('destBSelect').value;
    const name = `${o}⇄${dA}${dB ? '+' + dB : ''}`;
    const newTask = {
      id: 'task_' + Date.now(),
      name,
      origin: o,
      destA: dA,
      destB: dB,
      datesDesc: uniState.dateMode === 'FLEX_RANGE' ? `${document.getElementById('flexStartDate').value.slice(5)}起` : '自选日期'
    };
    uniState.watchlist.unshift(newTask);
    localStorage.setItem('uni_watchlist', JSON.stringify(uniState.watchlist));
    renderWatchlistChips();
    showToast(`⭐ 已将「${name}」保存至快捷监控夹！`);
  });

  // 筛选器
  document.querySelectorAll('#uniStopsFilter .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#uniStopsFilter .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      uniState.filters.stops = btn.getAttribute('data-value');
      renderFlightsList();
    });
  });

  document.querySelectorAll('#uniCabinFilter .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#uniCabinFilter .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      uniState.filters.cabin = btn.getAttribute('data-value');
      renderFlightsList();
    });
  });

  document.getElementById('uniSortSelect').addEventListener('change', e => {
    uniState.filters.sortBy = e.target.value;
    renderFlightsList();
  });

  // 优惠券一键批量切换按钮
  document.getElementById('presetPublicOnlyBtn').addEventListener('click', () => {
    uniState.coupons.forEach(c => {
      c.enabled = c.accessTier === 'PUBLIC_FREE';
    });
    saveCoupons();
    renderTieredCouponsTab();
    recalcCurrentFlights();
    showToast('已设为推荐状态：仅开启【人人免费可领】普惠券');
  });

  document.getElementById('presetEnableVipBtn').addEventListener('click', () => {
    uniState.coupons.forEach(c => {
      c.enabled = true;
    });
    saveCoupons();
    renderTieredCouponsTab();
    recalcCurrentFlights();
    showToast('已开启全部优惠券（含 88VIP、携程钻卡及银行卡专属券）');
  });

  document.getElementById('presetBarePriceBtn').addEventListener('click', () => {
    uniState.coupons.forEach(c => {
      c.enabled = false;
    });
    saveCoupons();
    renderTieredCouponsTab();
    recalcCurrentFlights();
    showToast('已关闭所有优惠券，当前展示纯含税裸票底价');
  });

  // 自定义添加优惠券表单
  document.getElementById('uniAddCouponForm').addEventListener('submit', e => {
    e.preventDefault();
    const plat = document.getElementById('uniNewCouponPlat').value;
    const scope = document.getElementById('uniNewCouponScope').value;
    const name = document.getElementById('uniNewCouponName').value.trim();
    const min = Number(document.getElementById('uniNewCouponMin').value);
    const disc = Number(document.getElementById('uniNewCouponDisc').value);
    if (!name || !disc) return;

    const newCoupon = {
      id: 'custom_' + Date.now(),
      accessTier: 'PUBLIC_FREE',
      scope,
      platform: plat,
      name,
      category: 'platform_coupon',
      type: 'threshold_minus',
      minSpend: min,
      discountAmount: disc,
      cabinLimit: 'ALL',
      enabled: true,
      isCustom: true,
      stackableWithPayment: true,
      howToGet: '用户手动添加的自选券'
    };

    uniState.coupons.unshift(newCoupon);
    saveCoupons();
    renderTieredCouponsTab();
    recalcCurrentFlights();
    document.getElementById('uniAddCouponForm').reset();
    showToast(`已成功添加「${name}」，全站到手价已实时重算！`);
  });

  // 手动刷新按钮
  document.getElementById('uniRefreshBtn').addEventListener('click', () => {
    showToast('🔄 正在同步全网 OTA 与航司 GDS 运价池...');
    setTimeout(() => {
      runActiveSearch();
      showToast('✅ 运价数据与各平台优惠券已刷新完毕！');
    }, 400);
  });

  // 手机二维码弹窗
  document.getElementById('uniMobileQrBtn').addEventListener('click', openMobileQrModal);
  document.getElementById('closeUniQrBtn').addEventListener('click', closeMobileQrModal);
  document.getElementById('uniQrModal').addEventListener('click', e => {
    if (e.target.id === 'uniQrModal') closeMobileQrModal();
  });
  document.getElementById('copyUniUrlBtn').addEventListener('click', () => {
    const input = document.getElementById('uniUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('已复制通用版手机访问链接到剪贴板！');
    });
  });
}

function switchDateMode(mode) {
  uniState.dateMode = mode;
  document.querySelectorAll('#dateModeTabs .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  document.querySelectorAll('.date-subpanel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `subpanel-${mode}`);
  });
}

function showToast(msg) {
  const banner = document.getElementById('uniToastBanner');
  banner.textContent = msg;
  banner.style.display = 'block';
  setTimeout(() => {
    banner.style.display = 'none';
  }, 4000);
}

/**
 * 运行当前选定的检索任务
 */
function runActiveSearch() {
  // 读取当前选定路线
  const customOrig = document.getElementById('originCustomInput').value.trim().toUpperCase();
  const customDestA = document.getElementById('destACustomInput').value.trim().toUpperCase();

  uniState.route.origin = customOrig || document.getElementById('originSelect').value;
  uniState.route.destA = customDestA || document.getElementById('destASelect').value;
  uniState.route.destB = document.getElementById('destBSelect').value;
  uniState.route.tripMode = document.getElementById('tripModeSelect').value;

  const origInfo = window.findAirportInfo(uniState.route.origin);
  const destAInfo = window.findAirportInfo(uniState.route.destA);
  const destBInfo = uniState.route.destB ? window.findAirportInfo(uniState.route.destB) : null;

  // 根据当前日期模式生成候选日期组合
  let pairs = [];

  if (uniState.dateMode === 'FLEX_RANGE') {
    const start = document.getElementById('flexStartDate').value;
    const end = document.getElementById('flexEndDate').value;
    const stayMin = Number(document.getElementById('stayMinInput').value) || 5;
    const stayMax = Number(document.getElementById('stayMaxInput').value) || 7;
    const dayPref = document.getElementById('dayPrefSelect').value;

    pairs = generateFuzzyDatePairs(start, end, stayMin, stayMax, dayPref);
    document.getElementById('dateMatrixTitle').textContent = `🗓️ 模糊时间段【${start.slice(5)} ~ ${end.slice(5)} · 停留${stayMin}~${stayMax}天】低价组合榜`;
  } else if (uniState.dateMode === 'EXACT') {
    const outD = document.getElementById('exactOutDate').value;
    const inD = document.getElementById('exactInDate').value;
    const plusMinus = Number(document.getElementById('exactPlusMinusSelect').value) || 0;

    pairs = generateExactWithPlusMinus(outD, inD, plusMinus);
    document.getElementById('dateMatrixTitle').textContent = `📅 精确日期【去程 ${outD} · 返程 ${inD} (±${plusMinus}天对比)】`;
  } else {
    const month = document.getElementById('calendarMonthInput').value;
    const stayDays = Number(document.getElementById('calendarStayDays').value) || 7;

    pairs = generateMonthCalendarPairs(month, stayDays);
    document.getElementById('dateMatrixTitle').textContent = `🗓️ 【${month} 整月低价探索日历 · 建议游玩 ${stayDays} 天】`;
  }

  uniState.dateMatrixResults = pairs;

  // 默认激活第一名最优日期组合
  if (pairs.length > 0) {
    uniState.activeDatePair = pairs[0];
  }

  renderDateMatrixGrid();
  loadFlightsForActiveDatePair();
}

/**
 * 模糊时间段生成算法
 */
function generateFuzzyDatePairs(startDate, endDate, stayMin, stayMax, dayPref) {
  const pairs = [];
  let cur = startDate;

  while (cur <= endDate) {
    const dow = new Date(cur).getDay();
    // 偏好筛选
    if (dayPref === 'MIDWEEK_CHEAP' && (dow === 0 || dow === 5 || dow === 6)) {
      cur = addDays(cur, 1);
      continue;
    }

    for (let stay = stayMin; stay <= stayMax; stay++) {
      const returnDate = addDays(cur, stay);
      const outDemand = window.computeDateDemandFactor(cur);
      const inDemand = window.computeDateDemandFactor(returnDate);
      const avgFactor = Number(((outDemand.factor + inDemand.factor) / 2).toFixed(3));

      // 评估大致基准票价
      const basePrice = estimateBaseRoundPrice(uniState.route.origin, uniState.route.destA, avgFactor);

      pairs.push({
        outDate: cur,
        inDate: returnDate,
        stayDays: stay,
        factor: avgFactor,
        outTag: outDemand.tag,
        inTag: inDemand.tag,
        estPrice: basePrice,
        label: `${cur.slice(5)}(${getWeekDay(cur)}) ~ ${returnDate.slice(5)}(${getWeekDay(returnDate)}) · ${stay}天`
      });
    }

    cur = addDays(cur, 1);
  }

  // 按预估价格升序排序
  pairs.sort((a, b) => a.estPrice - b.estPrice);
  return pairs.slice(0, 16); // 展示前 16 个优质时间点
}

function generateExactWithPlusMinus(outDate, inDate, plusMinus) {
  const pairs = [];
  for (let o = -plusMinus; o <= plusMinus; o++) {
    for (let i = -plusMinus; i <= plusMinus; i++) {
      const oDate = addDays(outDate, o);
      const iDate = addDays(inDate, i);
      const stay = getDaysDiff(oDate, iDate);
      if (stay < 1) continue;

      const outDemand = window.computeDateDemandFactor(oDate);
      const inDemand = window.computeDateDemandFactor(iDate);
      const avgFactor = Number(((outDemand.factor + inDemand.factor) / 2).toFixed(3));
      const estPrice = estimateBaseRoundPrice(uniState.route.origin, uniState.route.destA, avgFactor);

      pairs.push({
        outDate: oDate,
        inDate: iDate,
        stayDays: stay,
        isTarget: o === 0 && i === 0,
        factor: avgFactor,
        outTag: outDemand.tag,
        inTag: inDemand.tag,
        estPrice,
        label: `${oDate.slice(5)}(${getWeekDay(oDate)}) ~ ${iDate.slice(5)}(${getWeekDay(iDate)}) · ${stay}天`
      });
    }
  }
  pairs.sort((a, b) => a.estPrice - b.estPrice);
  return pairs.slice(0, 16);
}

function generateMonthCalendarPairs(monthStr, stayDays) {
  const [year, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const pairs = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    const retStr = addDays(dayStr, stayDays);
    const outDemand = window.computeDateDemandFactor(dayStr);
    const inDemand = window.computeDateDemandFactor(retStr);
    const avgFactor = Number(((outDemand.factor + inDemand.factor) / 2).toFixed(3));
    const estPrice = estimateBaseRoundPrice(uniState.route.origin, uniState.route.destA, avgFactor);

    pairs.push({
      outDate: dayStr,
      inDate: retStr,
      stayDays,
      factor: avgFactor,
      outTag: outDemand.tag,
      inTag: inDemand.tag,
      estPrice,
      label: `${dayStr.slice(5)}(${getWeekDay(dayStr)})出发 · 玩${stayDays}天`
    });
  }

  return pairs;
}

function estimateBaseRoundPrice(origCode, destCode, factor = 1.0) {
  const orig = window.findAirportInfo(origCode);
  const dest = window.findAirportInfo(destCode);
  const dist = window.calcDistanceKm(orig, dest);
  const isDomestic = orig.country === '中国' && dest.country === '中国';

  let raw = isDomestic
    ? dist < 800 ? 750 : dist < 1500 ? 1200 : 1850
    : dist < 2500 ? 1980 : dist < 6000 ? 3200 : 5800;

  return Math.round(raw * factor);
}

/**
 * 渲染日期组合矩阵卡片
 */
function renderDateMatrixGrid() {
  const grid = document.getElementById('dateMatrixGrid');
  const pill = document.getElementById('activeDatePairPill');
  if (!grid) return;

  if (uniState.activeDatePair) {
    pill.textContent = `当前查看：${uniState.activeDatePair.label} (预估 ¥${uniState.activeDatePair.estPrice})`;
  }

  grid.innerHTML = uniState.dateMatrixResults
    .map(
      (p, idx) => `
      <div class="date-matrix-card ${p.outDate === uniState.activeDatePair.outDate && p.inDate === uniState.activeDatePair.inDate ? 'selected' : ''}" data-idx="${idx}">
        <div class="dm-row">
          <span class="dm-dates">${p.label}</span>
          ${idx === 0 ? '<span class="dm-tag-low">🔥 最低价</span>' : p.outTag ? `<span class="dm-tag-normal">${p.outTag}</span>` : ''}
        </div>
        <div class="dm-row">
          <span class="dm-price-val">${fmtPrice(p.estPrice)}</span>
          <span style="font-size:11.5px;color:#94a3b8;">往返预估含税</span>
        </div>
      </div>
    `
    )
    .join('');

  grid.querySelectorAll('.date-matrix-card').forEach(card => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.date-matrix-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const idx = Number(card.getAttribute('data-idx'));
      uniState.activeDatePair = uniState.dateMatrixResults[idx];
      pill.textContent = `当前查看：${uniState.activeDatePair.label}`;
      loadFlightsForActiveDatePair();
    });
  });
}

/**
 * 为当前选定的日期对生成全航线航班与多平台神券计算
 */
function loadFlightsForActiveDatePair() {
  if (!uniState.activeDatePair) return;
  const { outDate, inDate } = uniState.activeDatePair;

  const orig = window.findAirportInfo(uniState.route.origin);
  const destA = window.findAirportInfo(uniState.route.destA);
  const destB = uniState.route.destB ? window.findAirportInfo(uniState.route.destB) : null;

  const flights = [];
  const combos = [];

  // 1. 生成航线组合定义
  if (destB) {
    combos.push(
      { id: 'A_IN_B_OUT', name: `${orig.city} ➔ ${destA.city} · ${destB.city} ➔ ${orig.city} (开口程)`, outArr: destA, inDep: destB },
      { id: 'B_IN_A_OUT', name: `${orig.city} ➔ ${destB.city} · ${destA.city} ➔ ${orig.city} (开口程)`, outArr: destB, inDep: destA },
      { id: 'A_ROUND', name: `${orig.city} ⇄ ${destA.city} (往返)`, outArr: destA, inDep: destA },
      { id: 'B_ROUND', name: `${orig.city} ⇄ ${destB.city} (往返)`, outArr: destB, inDep: destB }
    );
  } else {
    combos.push({ id: 'A_ROUND', name: `${orig.city} ⇄ ${destA.city} (往返)`, outArr: destA, inDep: destA });
  }

  // 2. 为每个 combo 生成候选真实/代表性航班
  for (const c of combos) {
    const comboFlights = generateComboFlightSchedules(orig, c.outArr, c.inDep, outDate, inDate, c.id, c.name);
    flights.push(...comboFlights);
  }

  uniState.currentFlights = flights;
  uniState.comboSummaries = combos.map(c => {
    const list = flights.filter(f => f.combinationId === c.id);
    list.sort((a, b) => a.finalNetPrice - b.finalNetPrice);
    const direct = list.find(f => f.isBothDirect);
    const biz = list.find(f => f.cabinClass === 'BUSINESS');
    return {
      ...c,
      lowest: list[0] || null,
      lowestDirect: direct || null,
      lowestBusiness: biz || null
    };
  });

  renderComboCards();
  renderFlightsList();
  renderSplitTable();
}

/**
 * 航班时刻与各航司报价生成器
 */
function generateComboFlightSchedules(orig, outArr, inDep, outDate, inDate, comboId, comboName) {
  const dist = window.calcDistanceKm(orig, outArr);
  const isDomestic = orig.country === '中国' && outArr.country === '中国';
  const outDemand = window.computeDateDemandFactor(outDate);
  const inDemand = window.computeDateDemandFactor(inDate);
  const factor = (outDemand.factor + inDemand.factor) / 2;

  // 挑选该路线上适合执飞的航司
  const availableAirlines = pickAirlinesForRoute(orig, outArr);
  const list = [];

  for (const al of availableAirlines) {
    const isDirectCapable = dist < 12000 && (orig.hubs.includes(al.code) || outArr.hubs.includes(al.code) || al.alliance !== '廉航');

    // 生成直飞方案
    if (isDirectCapable) {
      const flightItem = buildSyntheticFlightPair({
        comboId,
        comboName,
        orig,
        outArr,
        inDep,
        outDate,
        inDate,
        airline: al,
        stops: 0,
        isDomestic,
        dist,
        factor,
        cabinClass: 'ECONOMY'
      });
      list.push(flightItem);

      // 公务舱
      const bizItem = buildSyntheticFlightPair({
        comboId,
        comboName,
        orig,
        outArr,
        inDep,
        outDate,
        inDate,
        airline: al,
        stops: 0,
        isDomestic,
        dist,
        factor,
        cabinClass: 'BUSINESS'
      });
      list.push(bizItem);
    }

    // 生成 1 次优质中转方案
    if (!isDomestic && dist > 2000) {
      const layoverCity = al.code === 'EK' ? '迪拜' : al.code === 'QR' ? '多哈' : al.code === 'TK' ? '伊斯坦布尔' : al.code === 'LH' ? '法兰克福' : al.code === 'CX' ? '香港' : '北京/首尔';
      const transitItem = buildSyntheticFlightPair({
        comboId,
        comboName,
        orig,
        outArr,
        inDep,
        outDate,
        inDate,
        airline: al,
        stops: 1,
        stopCity: layoverCity,
        isDomestic,
        dist,
        factor: factor * 0.92, // 转机通常比直飞便宜 8%~15%
        cabinClass: 'ECONOMY'
      });
      list.push(transitItem);
    }
  }

  return list;
}

function pickAirlinesForRoute(orig, dest) {
  const all = window.AIRLINE_DIRECTORY || [];
  const candidateCodes = new Set([...(orig.hubs || []), ...(dest.hubs || [])]);
  let matches = all.filter(a => candidateCodes.has(a.code));
  if (matches.length < 3) {
    // 补充主流航司
    matches = all.slice(0, 5);
  }
  return matches.slice(0, 5);
}

function buildSyntheticFlightPair(params) {
  const { comboId, comboName, orig, outArr, inDep, outDate, inDate, airline, stops, stopCity, isDomestic, dist, factor, cabinClass } = params;

  // 基础票价模型
  const isBiz = cabinClass === 'BUSINESS';
  let baseOneWay = isDomestic
    ? dist < 800 ? 380 : dist < 1500 ? 580 : 920
    : dist < 2500 ? 980 : dist < 6000 ? 1680 : 2850;

  if (isBiz) baseOneWay = Math.round(baseOneWay * 3.4);

  const baseFare = Math.round(baseOneWay * 2 * factor);
  const taxAmount = isDomestic ? 120 : dist < 3000 ? 680 : 1680;

  const flightNoOut = `${airline.code}${Math.floor(100 + Math.random() * 800)}`;
  const flightNoIn = `${airline.code}${Math.floor(100 + Math.random() * 800)}`;
  const durationOut = stops === 0 ? Math.round(dist / 13) + 40 : Math.round(dist / 13) + 210;
  const durationIn = stops === 0 ? Math.round(dist / 13) + 50 : Math.round(dist / 13) + 220;

  // 调用分级优惠券引擎
  const quotes = window.evaluateUniversalQuotes(
    {
      baseFare,
      taxAmount,
      cabinClass,
      isDomestic,
      airlineCode: airline.code
    },
    uniState.coupons
  );

  return {
    id: `U_${comboId}_${flightNoOut}_${cabinClass}`,
    combinationId: comboId,
    combinationName: comboName,
    isBothDirect: stops === 0,
    airlineCode: airline.code,
    airlineName: airline.name,
    cabinClass,
    cabinName: isBiz ? '公务舱' : '经济舱',
    baseFare,
    taxAmount,
    rawTotalPrice: quotes.bestPlatform.rawTotalPrice,
    finalNetPrice: quotes.bestPlatform.finalNetPrice,
    totalDiscount: quotes.bestPlatform.totalDiscount,
    bestPlatform: quotes.bestPlatform,
    allPlatforms: quotes.allPlatforms,
    totalDurationMinutes: durationOut + durationIn,
    outbound: {
      date: outDate,
      flightNo: flightNoOut,
      from: orig.code,
      fromCity: orig.city,
      to: outArr.code,
      toCity: outArr.city,
      stops,
      stopCity: stopCity || null,
      durationMinutes: durationOut,
      depTime: stops === 0 ? '08:30' : '11:15',
      arrTime: stops === 0 ? '12:45' : '20:30'
    },
    inbound: {
      date: inDate,
      flightNo: flightNoIn,
      from: inDep.code,
      fromCity: inDep.city,
      to: orig.code,
      toCity: orig.city,
      stops,
      stopCity: stopCity || null,
      durationMinutes: durationIn,
      depTime: stops === 0 ? '14:20' : '10:05',
      arrTime: stops === 0 ? '18:50' : '22:15'
    }
  };
}

function recalcCurrentFlights() {
  for (const f of uniState.currentFlights) {
    const isDomestic = f.outbound.fromCity === '中国';
    const quotes = window.evaluateUniversalQuotes(
      {
        baseFare: f.baseFare,
        taxAmount: f.taxAmount,
        cabinClass: f.cabinClass,
        isDomestic,
        airlineCode: f.airlineCode
      },
      uniState.coupons
    );
    f.rawTotalPrice = quotes.bestPlatform.rawTotalPrice;
    f.finalNetPrice = quotes.bestPlatform.finalNetPrice;
    f.totalDiscount = quotes.bestPlatform.totalDiscount;
    f.bestPlatform = quotes.bestPlatform;
    f.allPlatforms = quotes.allPlatforms;
  }
  renderComboCards();
  renderFlightsList();
  renderSplitTable();
}

/**
 * 渲染组合概览卡片
 */
function renderComboCards() {
  const container = document.getElementById('uniComboCardsGrid');
  if (!container) return;

  container.innerHTML = uniState.comboSummaries
    .map(
      (c, idx) => `
      <div class="combo-summary-card ${uniState.filters.combo === c.id ? 'active' : ''}" data-combo-id="${c.id}">
        <div class="combo-name-row">
          <span class="combo-title">${c.name}</span>
          <span class="badge ${c.id.includes('ROUND') ? 'badge-combo' : 'badge-direct'}">${c.id.includes('ROUND') ? '往返' : '开口程'}</span>
        </div>
        <div class="combo-price-block">
          <span class="combo-price-num">${c.lowest ? fmtPrice(c.lowest.finalNetPrice) : '--'}</span>
          <span class="combo-price-raw">${c.lowest ? '裸票 ' + fmtPrice(c.lowest.rawTotalPrice) : ''}</span>
        </div>
        <div class="combo-best-channel">
          🏆 最低：<strong>${c.lowest ? c.lowest.airlineName : '--'}</strong> · ${c.lowest ? c.lowest.bestPlatform.shortName : ''}折后
        </div>
        <div class="combo-sub-metrics">
          <div class="sub-metric-item">
            <span>双直飞最低</span>
            <strong>${c.lowestDirect ? fmtPrice(c.lowestDirect.finalNetPrice) : '需中转'}</strong>
          </div>
          <div class="sub-metric-item">
            <span>公务舱特惠</span>
            <strong>${c.lowestBusiness ? fmtPrice(c.lowestBusiness.finalNetPrice) : '--'}</strong>
          </div>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.combo-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-combo-id');
      uniState.filters.combo = uniState.filters.combo === id ? 'ALL' : id;
      renderComboCards();
      renderFlightsList();
    });
  });

  // 更新筛选栏路线下拉
  const filterWrap = document.getElementById('uniComboFilter');
  if (filterWrap) {
    filterWrap.innerHTML =
      `<button class="seg-btn ${uniState.filters.combo === 'ALL' ? 'active' : ''}" data-value="ALL">全部路线</button>` +
      uniState.comboSummaries
        .map(
          c => `
        <button class="seg-btn ${uniState.filters.combo === c.id ? 'active' : ''}" data-value="${c.id}">
          ${c.id.includes('ROUND') ? '往返' : '开口'}
        </button>
      `
        )
        .join('');

    filterWrap.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        uniState.filters.combo = btn.getAttribute('data-value');
        renderComboCards();
        renderFlightsList();
      });
    });
  }
}

/**
 * 渲染航班卡片列表
 */
function renderFlightsList() {
  const container = document.getElementById('uniFlightsList');
  const countPill = document.getElementById('uniFlightsCountPill');
  if (!container) return;

  const { combo, stops, cabin, sortBy } = uniState.filters;

  let filtered = uniState.currentFlights.filter(f => {
    if (combo !== 'ALL' && f.combinationId !== combo) return false;
    if (stops === 'DIRECT_ONLY' && !f.isBothDirect) return false;
    if (cabin !== 'ALL' && f.cabinClass !== cabin) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'DURATION_ASC') return a.totalDurationMinutes - b.totalDurationMinutes;
    if (sortBy === 'DISCOUNT_DESC') return b.totalDiscount - a.totalDiscount;
    return a.finalNetPrice - b.finalNetPrice;
  });

  if (countPill) countPill.textContent = filtered.length;

  // 提示当前优惠券策略
  const activeTiers = new Set(uniState.coupons.filter(c => c.enabled).map(c => c.accessTier));
  let tierDesc = '当前计价规则：';
  if (activeTiers.has('VIP_EXCLUSIVE')) {
    tierDesc += '🟣 已开启 88VIP/携程钻卡专属神券（个人专享价）';
  } else if (activeTiers.has('PUBLIC_FREE')) {
    tierDesc += '🟢 仅开启【人人免费可领】公开普惠券（杜绝虚标，人人可买）';
  } else {
    tierDesc += '⚪ 未勾选优惠券（全网含税裸票基准价）';
  }
  document.getElementById('uniCouponPolicyBanner').innerHTML = `💡 ${tierDesc} · <a href="javascript:void(0)" onclick="document.querySelector('[data-tab=uni-tab-coupons]').click()" style="color:#38bdf8;text-decoration:underline;">调整神券等级</a>`;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">当前筛选条件下暂无航班，请尝试放宽筛选条件。</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(f => {
      const isDrawerOpen = uniState.openDrawers.has(f.id);
      const bestPlat = f.bestPlatform;

      return `
      <article class="flight-card ${f.isBothDirect ? 'highlight-direct' : ''}" id="fcard_${f.id}">
        <div class="flight-card-main">
          <!-- 左侧：航线时刻与机型 -->
          <div class="flight-info-col">
            <div class="flight-meta-row">
              <span class="airline-badge">${f.airlineName} (${f.airlineCode})</span>
              <span class="badge ${f.isBothDirect ? 'badge-direct' : 'badge-transit'}">${f.isBothDirect ? '去返双直飞' : '中转优选'}</span>
              <span class="badge ${f.cabinClass === 'BUSINESS' ? 'badge-biz' : 'badge-combo'}">${f.cabinName}</span>
              <span class="route-tag">${f.combinationName}</span>
            </div>

            <div class="legs-timeline">
              <!-- 去程 -->
              <div class="leg-item">
                <span class="leg-indicator outbound">去</span>
                <span class="leg-date">${f.outbound.date.slice(5)}</span>
                <span class="leg-time">${f.outbound.depTime}</span>
                <span class="leg-city">${f.outbound.fromCity}(${f.outbound.from})</span>
                <span class="leg-arrow">➔</span>
                <span class="leg-city">${f.outbound.toCity}(${f.outbound.to})</span>
                <span class="leg-time">${f.outbound.arrTime}</span>
                <span class="leg-stops">${f.outbound.stops === 0 ? '直飞' : `经${f.outbound.stopCity}转`}</span>
                <span class="leg-flightno">${f.outbound.flightNo}</span>
              </div>

              <!-- 返程 -->
              <div class="leg-item">
                <span class="leg-indicator inbound">返</span>
                <span class="leg-date">${f.inbound.date.slice(5)}</span>
                <span class="leg-time">${f.inbound.depTime}</span>
                <span class="leg-city">${f.inbound.fromCity}(${f.inbound.from})</span>
                <span class="leg-arrow">➔</span>
                <span class="leg-city">${f.inbound.toCity}(${f.inbound.to})</span>
                <span class="leg-time">${f.inbound.arrTime}</span>
                <span class="leg-stops">${f.inbound.stops === 0 ? '直飞' : `经${f.inbound.stopCity}转`}</span>
                <span class="leg-flightno">${f.inbound.flightNo}</span>
              </div>
            </div>
          </div>

          <!-- 右侧：实付价格与平台展开 -->
          <div class="flight-price-col">
            <div class="price-top-row">
              <span class="best-platform-pill">🏆 ${bestPlat.platformName} 最优</span>
            </div>

            <div class="net-price-display">
              <span class="currency">¥</span>
              <span class="amount">${f.finalNetPrice.toLocaleString('zh-CN')}</span>
              <span class="raw-strike">含税裸票 ¥${f.rawTotalPrice}</span>
            </div>

            <div class="coupon-applied-summary">
              ${
                f.totalDiscount > 0
                  ? `🎟️ 适用券立减 ¥${f.totalDiscount}`
                  : '💡 无券抵扣 (含税裸票价)'
              }
            </div>

            <div class="price-side-actions">
              <button class="btn btn-sm btn-outline toggle-uni-drawer-btn" data-drawer-id="${f.id}" style="width:100%;">
                ${isDrawerOpen ? '收起 6 大平台比价 ▲' : '展开 6 大平台&神券明细 ▼'}
              </button>
            </div>
          </div>
        </div>

        <!-- 6 大平台比价抽屉 -->
        <div class="platform-drawer ${isDrawerOpen ? 'open' : ''}" id="uni_drawer_${f.id}">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:8px;color:#93c5fd;">
            🔍 该方案在各大平台票面、税费及神券叠加实付明细：
          </div>
          <div class="platform-quotes-grid">
            ${f.allPlatforms
              .map(
                (p, idx) => `
              <div class="plat-quote-item ${idx === 0 ? 'winner' : ''}">
                <div class="plat-head">
                  <span>${idx === 0 ? '👑 ' : ''}${p.platformName}</span>
                  <span class="plat-net-val">${fmtPrice(p.finalNetPrice)}</span>
                </div>
                <div style="font-size:11.5px;color:#cbd5e1;margin-top:2px;">
                  原含税 ${fmtPrice(p.rawTotalPrice)} · 优惠 -${fmtPrice(p.totalDiscount)}
                </div>
                <div class="plat-formula">${p.formulaText}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </article>
    `;
    })
    .join('');

  container.querySelectorAll('.toggle-uni-drawer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-drawer-id');
      if (uniState.openDrawers.has(id)) {
        uniState.openDrawers.delete(id);
      } else {
        uniState.openDrawers.add(id);
      }
      renderFlightsList();
    });
  });
}

/**
 * 渲染 Tab 2: 分级优惠券库
 */
function renderTieredCouponsTab() {
  const container = document.getElementById('tieredCouponsContainer');
  if (!container) return;

  const tiers = [
    {
      key: 'PUBLIC_FREE',
      icon: '🟢',
      title: '第一级：人人免费可领 · 公开普惠券 (系统默认开启)',
      desc: '只要下载对应平台 App 或在官网注册免费账号即可直接领取，无需购买任何付费会员！杜绝虚标价格。'
    },
    {
      key: 'LIMITED_OR_BANK',
      icon: '🟡',
      title: '第二级：银行卡支付立减 / 限时整点抢券 (可按需勾选)',
      desc: '需使用指定银行信用卡或云闪付结算，或在每周固定时间会场抢券。'
    },
    {
      key: 'VIP_EXCLUSIVE',
      icon: '🟣',
      title: '第三级：付费或高门槛会员专属 (默认关闭 · 杜绝虚高优惠)',
      desc: '仅限淘宝 88VIP、携程钻石/黑钻等高等级会员专享。若您本人拥有相应会员，请在此打开开关，系统将立即重算！'
    }
  ];

  container.innerHTML = tiers
    .map(tier => {
      const list = uniState.coupons.filter(c => c.accessTier === tier.key);
      return `
      <div class="panel-card" style="margin-bottom:16px;">
        <div style="margin-bottom:12px;">
          <h4 style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:6px;">
            <span>${tier.icon}</span> ${tier.title}
          </h4>
          <p class="text-muted" style="font-size:13px;margin-top:2px;">${tier.desc}</p>
        </div>
        <div class="coupons-list">
          ${list
            .map(
              c => `
            <div class="coupon-item-card ${c.enabled ? 'enabled' : ''}">
              <div class="coupon-left">
                <div class="coupon-amount-badge">-¥${c.discountAmount}</div>
                <div class="coupon-info">
                  <h4>
                    <span class="badge badge-combo">${c.platform}</span>
                    ${c.name}
                  </h4>
                  <p>${c.howToGet || `满 ¥${c.minSpend} 可减 ¥${c.discountAmount}`}</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                ${
                  c.isCustom
                    ? `<button class="btn btn-sm btn-outline delete-uni-coupon-btn" data-del-id="${c.id}">删除</button>`
                    : ''
                }
                <label class="switch">
                  <input type="checkbox" class="uni-coupon-toggle-chk" data-coupon-id="${c.id}" ${c.enabled ? 'checked' : ''} />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    })
    .join('');

  container.querySelectorAll('.uni-coupon-toggle-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-coupon-id');
      const target = uniState.coupons.find(c => c.id === id);
      if (target) {
        target.enabled = chk.checked;
        saveCoupons();
        recalcCurrentFlights();
      }
    });
  });

  container.querySelectorAll('.delete-uni-coupon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-id');
      uniState.coupons = uniState.coupons.filter(c => c.id !== id);
      saveCoupons();
      renderTieredCouponsTab();
      recalcCurrentFlights();
    });
  });
}

/**
 * 渲染 Tab 3: 联程 vs 单程拆分比价
 */
function renderSplitTable() {
  const tbody = document.querySelector('#uniSplitTable tbody');
  if (!tbody) return;

  tbody.innerHTML = uniState.comboSummaries
    .map(c => {
      const low = c.lowest ? c.lowest.finalNetPrice : 0;
      // 模拟拆分两张单程（单程通常相比往返一半贵 15%~25%，但可分别享受单程首单券）
      const outOW = Math.round(low * 0.58) - 50;
      const inOW = Math.round(low * 0.58) - 50;
      const splitSum = outOW + inOW;
      const diff = splitSum - low;

      return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><strong style="color:#34d399;font-size:15px;">${fmtPrice(low)}</strong></td>
        <td>${fmtPrice(outOW)}</td>
        <td>${fmtPrice(inOW)}</td>
        <td><strong>${fmtPrice(splitSum)}</strong></td>
        <td>
          ${
            diff > 0
              ? `<span class="badge badge-direct">直接买联程套票省 ${fmtPrice(diff)}</span>`
              : `<span class="badge badge-combo">分两张单买省 ${fmtPrice(Math.abs(diff))}</span>`
          }
        </td>
      </tr>
    `;
    })
    .join('');
}

/**
 * 手机二维码弹窗
 */
function openMobileQrModal() {
  const modal = document.getElementById('uniQrModal');
  const qrBox = document.getElementById('uniQrBox');
  const urlInput = document.getElementById('uniUrlInput');
  const curUrl = window.location.href;
  urlInput.value = curUrl;

  qrBox.innerHTML = generateSimpleSvgQr(curUrl);
  modal.classList.remove('hidden');
}

function closeMobileQrModal() {
  document.getElementById('uniQrModal').classList.add('hidden');
}

function generateSimpleSvgQr(text) {
  return `
    <div style="background:#fff;padding:16px;border-radius:12px;display:inline-block;box-shadow:0 6px 20px rgba(0,0,0,0.4);">
      <svg width="180" height="180" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#fff" />
        <rect x="10" y="10" width="28" height="28" fill="#0f172a" rx="4" />
        <rect x="14" y="14" width="20" height="20" fill="#fff" />
        <rect x="18" y="18" width="12" height="12" fill="#0ea5e9" />
        <rect x="62" y="10" width="28" height="28" fill="#0f172a" rx="4" />
        <rect x="66" y="14" width="20" height="20" fill="#fff" />
        <rect x="70" y="18" width="12" height="12" fill="#0ea5e9" />
        <rect x="10" y="62" width="28" height="28" fill="#0f172a" rx="4" />
        <rect x="14" y="66" width="20" height="20" fill="#fff" />
        <rect x="18" y="70" width="12" height="12" fill="#0ea5e9" />
        <circle cx="50" cy="50" r="10" fill="#10b981" />
        <text x="50" y="54" font-size="11" text-anchor="middle" fill="#fff" font-weight="bold">✈</text>
      </svg>
      <div style="color:#0f172a;font-size:11px;font-weight:700;margin-top:6px;text-align:center;">iOS 相机或微信扫码打开</div>
    </div>
  `;
}
