/**
 * 全球与中国国内核心城市/机场数据库 & 智能航线时刻与运价生成引擎
 * 支持任意起点、任意终点（可多选组成开口程/比价池）、国内+国际全航线
 */

const AIRPORT_DB = [
  // ==================== 中国大陆热门城市 ====================
  { code: 'SHA', iata: 'PVG/SHA', city: '上海', country: '中国', region: 'DOMESTIC', lat: 31.14, lon: 121.80, hubs: ['MU', 'CA', 'HO', 'FM', '9C'] },
  { code: 'BJS', iata: 'PEK/PKX', city: '北京', country: '中国', region: 'DOMESTIC', lat: 40.08, lon: 116.58, hubs: ['CA', 'MU', 'CZ', 'HU', 'KN'] },
  { code: 'CAN', iata: 'CAN', city: '广州', country: '中国', region: 'DOMESTIC', lat: 23.39, lon: 113.30, hubs: ['CZ', 'CA', 'HU', 'ZH', 'AQ'] },
  { code: 'SZX', iata: 'SZX', city: '深圳', country: '中国', region: 'DOMESTIC', lat: 22.64, lon: 113.81, hubs: ['ZH', 'CZ', 'HU', 'CA', 'DZ'] },
  { code: 'CTU', iata: 'TFU/CTU', city: '成都', country: '中国', region: 'DOMESTIC', lat: 30.57, lon: 103.95, hubs: ['3U', 'CA', 'MU', 'CZ', 'EU'] },
  { code: 'HGH', iata: 'HGH', city: '杭州', country: '中国', region: 'DOMESTIC', lat: 30.23, lon: 120.43, hubs: ['CA', 'MU', 'GJ', 'CZ', 'MF'] },
  { code: 'CKG', iata: 'CKG', city: '重庆', country: '中国', region: 'DOMESTIC', lat: 29.72, lon: 106.64, hubs: ['3U', 'CA', 'PN', 'CZ', 'G5'] },
  { code: 'XIY', iata: 'XIY', city: '西安', country: '中国', region: 'DOMESTIC', lat: 34.44, lon: 108.75, hubs: ['MU', 'HU', 'CZ', 'GS'] },
  { code: 'NKG', iata: 'NKG', city: '南京', country: '中国', region: 'DOMESTIC', lat: 31.74, lon: 118.86, hubs: ['MU', 'ZH', 'HO'] },
  { code: 'WUH', iata: 'WUH', city: '武汉', country: '中国', region: 'DOMESTIC', lat: 30.78, lon: 114.21, hubs: ['CZ', 'MU', 'CA'] },
  { code: 'CSX', iata: 'CSX', city: '长沙', country: '中国', region: 'DOMESTIC', lat: 28.19, lon: 113.22, hubs: ['CZ', 'MF', 'HU'] },
  { code: 'XMN', iata: 'XMN', city: '厦门', country: '中国', region: 'DOMESTIC', lat: 24.54, lon: 118.13, hubs: ['MF', 'MU', 'SC'] },
  { code: 'KMG', iata: 'KMG', city: '昆明', country: '中国', region: 'DOMESTIC', lat: 25.10, lon: 102.93, hubs: ['MU', '8L', 'KY', '3U'] },
  { code: 'SYX', iata: 'SYX', city: '三亚', country: '中国', region: 'DOMESTIC', lat: 18.30, lon: 109.41, hubs: ['HU', 'CZ', 'MU', 'CA'] },
  { code: 'HAK', iata: 'HAK', city: '海口', country: '中国', region: 'DOMESTIC', lat: 19.93, lon: 110.46, hubs: ['HU', 'CZ', 'JD'] },
  { code: 'TAO', iata: 'TAO', city: '青岛', country: '中国', region: 'DOMESTIC', lat: 36.27, lon: 120.38, hubs: ['SC', 'MU', 'QW'] },
  { code: 'HRB', iata: 'HRB', city: '哈尔滨', country: '中国', region: 'DOMESTIC', lat: 45.62, lon: 126.25, hubs: ['CZ', '3U', 'MU'] },
  { code: 'URC', iata: 'URC', city: '乌鲁木齐', country: '中国', region: 'DOMESTIC', lat: 43.91, lon: 87.47, hubs: ['CZ', 'UQ', 'CA'] },
  { code: 'LJG', iata: 'LJG', city: '丽江', country: '中国', region: 'DOMESTIC', lat: 26.68, lon: 100.24, hubs: ['MU', '8L', 'JD'] },

  // ==================== 港澳台及亚太短途 ====================
  { code: 'HKG', iata: 'HKG', city: '香港', country: '中国香港', region: 'ASIA_SHORT', lat: 22.31, lon: 113.91, hubs: ['CX', 'HX', 'UO', 'MU', 'CA'] },
  { code: 'MFM', iata: 'MFM', city: '澳门', country: '中国澳门', region: 'ASIA_SHORT', lat: 22.15, lon: 113.59, hubs: ['NX', 'MU', '9C'] },
  { code: 'TPE', iata: 'TPE/TSA', city: '台北', country: '中国台湾', region: 'ASIA_SHORT', lat: 25.08, lon: 121.23, hubs: ['CI', 'BR', 'CA', 'MU'] },
  { code: 'TYO', iata: 'NRT/HND', city: '东京', country: '日本', region: 'ASIA_SHORT', lat: 35.76, lon: 140.39, hubs: ['NH', 'JL', 'MU', 'CA', 'HO', '9C'] },
  { code: 'OSA', iata: 'KIX', city: '大阪', country: '日本', region: 'ASIA_SHORT', lat: 34.43, lon: 135.23, hubs: ['NH', 'JL', 'MU', 'HO', 'CA', '9C'] },
  { code: 'SPK', iata: 'CTS', city: '札幌(北海道)', country: '日本', region: 'ASIA_SHORT', lat: 42.78, lon: 141.69, hubs: ['NH', 'JL', 'MU', '9C'] },
  { code: 'SEL', iata: 'ICN/GMP', city: '首尔', country: '韩国', region: 'ASIA_SHORT', lat: 37.46, lon: 126.44, hubs: ['KE', 'OZ', 'MU', 'CZ', 'CA'] },
  { code: 'CJU', iata: 'CJU', city: '济州岛', country: '韩国', region: 'ASIA_SHORT', lat: 33.51, lon: 126.49, hubs: ['9C', 'HO', 'MU', '7C'] },
  { code: 'SIN', iata: 'SIN', city: '新加坡', country: '新加坡', region: 'ASIA_MID', lat: 1.36, lon: 103.99, hubs: ['SQ', 'TR', 'MU', 'CA', 'HO'] },
  { code: 'BKK', iata: 'BKK/DMK', city: '曼谷', country: '泰国', region: 'ASIA_SHORT', lat: 13.69, lon: 100.75, hubs: ['TG', 'MU', 'HO', '9C', 'FD'] },
  { code: 'HKT', iata: 'HKT', city: '普吉岛', country: '泰国', region: 'ASIA_SHORT', lat: 8.11, lon: 98.32, hubs: ['MU', 'HO', '9C', 'TG'] },
  { code: 'KUL', iata: 'KUL', city: '吉隆坡', country: '马来西亚', region: 'ASIA_MID', lat: 2.75, lon: 101.71, hubs: ['MH', 'D7', 'MU', 'CZ'] },
  { code: 'DPS', iata: 'DPS', city: '巴厘岛', country: '印尼', region: 'ASIA_MID', lat: -8.75, lon: 115.17, hubs: ['MU', 'GA', 'SQ', 'CX'] },

  // ==================== 欧洲热门目的地 ====================
  { code: 'MXP', iata: 'MXP/LIN', city: '米兰', country: '意大利', region: 'EUROPE', lat: 45.63, lon: 8.72, hubs: ['CA', 'HO', 'QR', 'EK', 'LH', 'TK'] },
  { code: 'FCO', iata: 'FCO', city: '罗马', country: '意大利', region: 'EUROPE', lat: 41.80, lon: 12.25, hubs: ['MU', 'CA', 'QR', 'EK', 'AF', 'LH'] },
  { code: 'PAR', iata: 'CDG/ORY', city: '巴黎', country: '法国', region: 'EUROPE', lat: 49.01, lon: 2.55, hubs: ['AF', 'MU', 'CA', 'QR', 'EK'] },
  { code: 'LON', iata: 'LHR/LGW', city: '伦敦', country: '英国', region: 'EUROPE', lat: 51.47, lon: -0.45, hubs: ['BA', 'VS', 'MU', 'CA', 'CX'] },
  { code: 'FRA', iata: 'FRA', city: '法兰克福', country: '德国', region: 'EUROPE', lat: 50.03, lon: 8.57, hubs: ['LH', 'CA', 'MU', 'QR', 'EK'] },
  { code: 'MUC', iata: 'MUC', city: '慕尼黑', country: '德国', region: 'EUROPE', lat: 48.35, lon: 11.79, hubs: ['LH', 'CA', 'QR', 'EK'] },
  { code: 'ZRH', iata: 'ZRH', city: '苏黎世', country: '瑞士', region: 'EUROPE', lat: 47.46, lon: 8.55, hubs: ['LX', 'CA', 'LH', 'QR'] },
  { code: 'AMS', iata: 'AMS', city: '阿姆斯特丹', country: '荷兰', region: 'EUROPE', lat: 52.31, lon: 4.76, hubs: ['KL', 'MU', 'CZ', 'CX'] },
  { code: 'MAD', iata: 'MAD', city: '马德里', country: '西班牙', region: 'EUROPE', lat: 40.49, lon: -3.57, hubs: ['CA', 'MU', 'HU', 'QR', 'EK'] },
  { code: 'BCN', iata: 'BCN', city: '巴塞罗那', country: '西班牙', region: 'EUROPE', lat: 41.30, lon: 2.08, hubs: ['CA', 'QR', 'EK', 'LH', 'AF'] },
  { code: 'IST', iata: 'IST', city: '伊斯坦布尔', country: '土耳其', region: 'EUROPE', lat: 41.28, lon: 28.75, hubs: ['TK', 'MU', 'CZ', 'QR'] },
  { code: 'ATH', iata: 'ATH', city: '雅典', country: '希腊', region: 'EUROPE', lat: 37.94, lon: 23.94, hubs: ['CA', 'HO', 'QR', 'EK', 'TK'] },

  // ==================== 中东、澳新、北美 ====================
  { code: 'DXB', iata: 'DXB', city: '迪拜', country: '阿联酋', region: 'MIDDLE_EAST', lat: 25.25, lon: 55.36, hubs: ['EK', 'MU', 'CA', 'CZ'] },
  { code: 'DOH', iata: 'DOH', city: '多哈', country: '卡塔尔', region: 'MIDDLE_EAST', lat: 25.27, lon: 51.61, hubs: ['QR', 'CZ', 'MU'] },
  { code: 'CAI', iata: 'CAI', city: '开罗', country: '埃及', region: 'MIDDLE_EAST', lat: 30.12, lon: 31.41, hubs: ['MS', 'MU', '3U', 'HU'] },
  { code: 'SYD', iata: 'SYD', city: '悉尼', country: '澳大利亚', region: 'OCEANIA', lat: -33.95, lon: 151.18, hubs: ['MU', 'CZ', 'CA', 'QF', 'SQ', 'CX'] },
  { code: 'MEL', iata: 'MEL', city: '墨尔本', country: '澳大利亚', region: 'OCEANIA', lat: -37.67, lon: 144.84, hubs: ['MU', 'CZ', 'CA', 'HO', 'SQ', 'CX'] },
  { code: 'AKL', iata: 'AKL', city: '奥克兰', country: '新西兰', region: 'OCEANIA', lat: -37.01, lon: 174.79, hubs: ['NZ', 'MU', 'CZ', 'CA', 'CX'] },
  { code: 'LAX', iata: 'LAX', city: '洛杉矶', country: '美国', region: 'NORTH_AMERICA', lat: 33.94, lon: -118.41, hubs: ['CA', 'MU', 'CZ', 'UA', 'DL', 'CX'] },
  { code: 'SFO', iata: 'SFO', city: '旧金山', country: '美国', region: 'NORTH_AMERICA', lat: 37.62, lon: -122.38, hubs: ['UA', 'CA', 'MU', 'CZ', 'CX'] },
  { code: 'JFK', iata: 'JFK/EWR', city: '纽约', country: '美国', region: 'NORTH_AMERICA', lat: 40.64, lon: -73.78, hubs: ['MU', 'CA', 'CX', 'QR', 'EK', 'BR'] },
  { code: 'YVR', iata: 'YVR', city: '温哥华', country: '加拿大', region: 'NORTH_AMERICA', lat: 49.19, lon: -123.18, hubs: ['AC', 'CA', 'MU', 'CZ', 'CX'] }
];

const AIRLINE_DIRECTORY = {
  CA: { code: 'CA', name: '中国国际航空', alliance: '星空联盟', isLowCost: false },
  MU: { code: 'MU', name: '中国东方航空', alliance: '天合联盟', isLowCost: false },
  CZ: { code: 'CZ', name: '中国南方航空', alliance: '天合/伙伴', isLowCost: false },
  HU: { code: 'HU', name: '海南航空', alliance: '五星航司', isLowCost: false },
  HO: { code: 'HO', name: '吉祥航空', alliance: '星盟优连', isLowCost: false },
  '3U': { code: '3U', name: '四川航空', alliance: '川航熊猫', isLowCost: false },
  MF: { code: 'MF', name: '厦门航空', alliance: '天合联盟', isLowCost: false },
  ZH: { code: 'ZH', name: '深圳航空', alliance: '星空联盟', isLowCost: false },
  '9C': { code: '9C', name: '春秋航空', alliance: '高性价比低成本', isLowCost: true },
  CX: { code: 'CX', name: '国泰航空', alliance: '寰宇一家', isLowCost: false },
  NH: { code: 'NH', name: '全日空航空', alliance: '星空联盟', isLowCost: false },
  JL: { code: 'JL', name: '日本航空', alliance: '寰宇一家', isLowCost: false },
  SQ: { code: 'SQ', name: '新加坡航空', alliance: '星空联盟', isLowCost: false },
  QR: { code: 'QR', name: '卡塔尔航空', alliance: '寰宇一家', isLowCost: false },
  EK: { code: 'EK', name: '阿联酋航空', alliance: '五星旗舰', isLowCost: false },
  LH: { code: 'LH', name: '汉莎航空', alliance: '星空联盟', isLowCost: false },
  AF: { code: 'AF', name: '法国航空', alliance: '天合联盟', isLowCost: false },
  KL: { code: 'KL', name: '荷兰皇家航空', alliance: '天合联盟', isLowCost: false },
  TK: { code: 'TK', name: '土耳其航空', alliance: '星空联盟', isLowCost: false },
  BA: { code: 'BA', name: '英国航空', alliance: '寰宇一家', isLowCost: false },
  LX: { code: 'LX', name: '瑞士国际航空', alliance: '星空联盟', isLowCost: false },
  KE: { code: 'KE', name: '大韩航空', alliance: '天合联盟', isLowCost: false },
  OZ: { code: 'OZ', name: '韩亚航空', alliance: '星空联盟', isLowCost: false },
  TG: { code: 'TG', name: '泰国国际航空', alliance: '星空联盟', isLowCost: false },
  QF: { code: 'QF', name: '澳洲航空', alliance: '寰宇一家', isLowCost: false },
  UA: { code: 'UA', name: '美联航', alliance: '星空联盟', isLowCost: false }
};

/**
 * 热门预设监控路线模板（一键填入体验）
 */
const PRESET_WATCH_TEMPLATES = [
  {
    id: 'preset_japan_openjaw',
    title: '🇯🇵 日本黄金周：上海 → 东京/大阪 (开口/往返)',
    origin: 'SHA',
    destinations: ['TYO', 'OSA'],
    tripMode: 'ROUND_OR_OPENJAW',
    dateMode: 'FLEX_RANGE',
    flexStart: '2027-05-01',
    flexEnd: '2027-05-18',
    stayMin: 5,
    stayMax: 7
  },
  {
    id: 'preset_italy_410',
    title: '🇮🇹 意大利经典：4/10 上海 → 米兰/罗马 · 4/24 返',
    origin: 'SHA',
    destinations: ['MXP', 'FCO'],
    tripMode: 'ROUND_OR_OPENJAW',
    dateMode: 'EXACT',
    outboundDate: '2027-04-10',
    inboundDate: '2027-04-24',
    flexStart: '2027-04-07',
    flexEnd: '2027-04-28',
    stayMin: 12,
    stayMax: 15
  },
  {
    id: 'preset_domestic_sanya',
    title: '🌴 国内度假：上海/北京 → 三亚/海口 (模糊区间找低价)',
    origin: 'SHA',
    destinations: ['SYX', 'HAK'],
    tripMode: 'ROUND_OR_OPENJAW',
    dateMode: 'FLEX_RANGE',
    flexStart: '2026-12-05',
    flexEnd: '2026-12-25',
    stayMin: 4,
    stayMax: 6
  },
  {
    id: 'preset_europe_fr_uk',
    title: '🇫🇷🇬🇧 英法连线：北京/上海 → 巴黎/伦敦 (整月低价日历)',
    origin: 'SHA',
    destinations: ['PAR', 'LON'],
    tripMode: 'ROUND_OR_OPENJAW',
    dateMode: 'MONTH_CALENDAR',
    calendarMonth: '2027-05',
    stayMin: 9,
    stayMax: 11
  },
  {
    id: 'preset_se_asia_sin_bkk',
    title: '🇸🇬🇹🇭 新马泰免签：广州/深圳 → 新加坡/曼谷',
    origin: 'CAN',
    destinations: ['SIN', 'BKK'],
    tripMode: 'ROUND_OR_OPENJAW',
    dateMode: 'FLEX_RANGE',
    flexStart: '2026-11-15',
    flexEnd: '2026-12-10',
    stayMin: 4,
    stayMax: 6
  }
];

function findAirportInfo(codeOrText) {
  if (!codeOrText) return AIRPORT_DB[0];
  const clean = String(codeOrText).trim().toUpperCase();
  const found = AIRPORT_DB.find(
    a =>
      a.code === clean ||
      a.iata.includes(clean) ||
      a.city.includes(clean) ||
      `${a.city}(${a.code})` === clean
  );
  if (found) return found;
  // 支持用户输入任意自定义城市/三字码
  return {
    code: clean.slice(0, 3) || 'CUS',
    iata: clean.slice(0, 3) || 'CUS',
    city: codeOrText.trim(),
    country: '全球/自定义',
    region: /^[A-Z]{3}$/.test(clean) ? 'EUROPE' : 'DOMESTIC',
    lat: 35.0,
    lon: 110.0,
    hubs: ['CA', 'MU', 'CZ', 'QR', 'EK']
  };
}

/**
 * 计算两座机场之间的球面距离 (km)，用于自适应推算飞行时长、基准票价与税费
 */
function calcDistanceKm(a1, a2) {
  const R = 6371;
  const dLat = ((a2.lat - a1.lat) * Math.PI) / 180;
  const dLon = ((a2.lon - a1.lon) * Math.PI) / 180;
  const lat1 = (a1.lat * Math.PI) / 180;
  const lat2 = (a2.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return Math.max(350, Math.round(R * c));
}

/**
 * 计算指定日期的季节/星期/节假日运价波动系数（用于模糊日期区间和整月日历比价）
 */
function computeDateDemandFactor(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { factor: 1.0, tag: '平峰' };

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay(); // 0=周日, 5=周五, 6=周六

  // 确定性哈希微扰（让每天价格呈现真实航司舱位梯度差）
  const seed = (d.getFullYear() * 372 + month * 31 + day) * 2654435761;
  const pseudoRand = ((seed >>> 0) % 1000) / 1000; // 0 ~ 1

  let factor = 0.92 + pseudoRand * 0.16;
  let tag = '平日好价';

  // 周二、周三国际/国内长途往往是每周价格洼地
  if (dow === 2 || dow === 3) {
    factor -= 0.08;
    tag = '周二/三低谷日';
  } else if (dow === 5 || dow === 6) {
    factor += 0.09;
    tag = '周末出行溢价';
  }

  // 五一黄金周 (4/29 - 5/5)
  if ((month === 4 && day >= 29) || (month === 5 && day <= 4)) {
    factor += 0.34;
    tag = '五一高峰';
  }
  // 国庆黄金周 (9/28 - 10/7)
  else if ((month === 9 && day >= 28) || (month === 10 && day <= 6)) {
    factor += 0.38;
    tag = '国庆高峰';
  }
  // 春节/暑期旺季
  else if (month === 7 || month === 8 || (month === 2 && day <= 18)) {
    factor += 0.18;
    tag = '寒暑旺季';
  }
  // 错峰神价日（每月 10~18 日周二/周三/周四）
  else if (day >= 10 && day <= 19 && (dow === 2 || dow === 3 || dow === 4)) {
    factor -= 0.06;
    tag = '🔥 错峰地板价';
  }

  return {
    factor: Math.max(0.76, Number(factor.toFixed(3))),
    tag
  };
}

window.AIRPORT_DB = AIRPORT_DB;
window.AIRLINE_DIRECTORY = AIRLINE_DIRECTORY;
window.PRESET_WATCH_TEMPLATES = PRESET_WATCH_TEMPLATES;
window.findAirportInfo = findAirportInfo;
window.calcDistanceKm = calcDistanceKm;
window.computeDateDemandFactor = computeDateDemandFactor;
