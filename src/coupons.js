/**
 * 平台出票渠道与比价引擎
 * 严格遵循民航商业规则：
 * 1. 跨航司组合 (如 CA967去 + MU244返)：
 *    - 仅 携程/OTA 支持跨航司拆分出票 (组合特价 ¥8,522)
 *    - 国航/东航官网 无法出售对方航司回程票 (明确标注：不支持跨航司出票)
 *    - Google Flights 无法跨联盟拆单出票 (明确标注：不支持跨航司拆单)
 * 2. 同航司纯往返 (如 国航往返 CA967+CA968, 东航往返 MU243+MU244, 东航罗马 MU787+MU788)：
 *    - 携程官方: 真实出票价 (国航往返 ¥9,245, 东航往返 ¥9,712, 罗马往返 ¥11,865)
 *    - 航司官网直营: 真实直销价 (国航/东航官网直售同票号同价)
 *    - Google Flights: 国际航线收录比价参考
 */

const PLATFORMS = {
  ctrip: {
    id: 'ctrip',
    name: '携程旅行',
    shortName: '携程官方',
    color: '#2577e3',
    badgeBg: '#e8f2ff',
    bookingUrl: (dep, arr, date, retDep, retArr, retDate) => {
      const d = (dep || 'SHA').toLowerCase();
      const a = (arr || 'MIL').toLowerCase();
      if (retDate) {
        const rd = (retDep || 'ROM').toLowerCase();
        const ra = (retArr || 'SHA').toLowerCase();
        if (dep !== ra || arr !== rd) {
          return `https://flights.ctrip.com/international/search/multicity`;
        }
        return `https://flights.ctrip.com/online/list/round-${d}-${a}?depdate=${date}_${retDate}&cabin=y_s&adult=1`;
      }
      return `https://flights.ctrip.com/international/search/oneway-${d}-${a}?depdate=${date}&cabin=y_s&adult=1`;
    }
  },
  airline_direct: {
    id: 'airline_direct',
    name: '航司官方直销',
    shortName: '航司官网',
    color: '#7c3aed',
    badgeBg: '#f3e8ff',
    bookingUrl: (airlineCode) => {
      if (airlineCode === 'CA') return 'https://www.airchina.com.cn/';
      if (airlineCode === 'MU') return 'https://www.ceair.com/';
      return 'https://www.airchina.com.cn/';
    }
  },
  google_flights: {
    id: 'google_flights',
    name: 'Google Flights',
    shortName: 'Google比价',
    color: '#0f9d58',
    badgeBg: '#e6f4ea',
    bookingUrl: (dep, arr, date, retDep, retArr, retDate) => {
      if (retDate && arr === retDep) {
        return `https://www.google.com/travel/flights?q=flights%20from%20${dep}%20to%20${arr}%20on%20${date}%20return%20${retDate}&curr=CNY`;
      }
      return `https://www.google.com/travel/flights?hl=zh-CN&gl=CN&curr=CNY`;
    }
  }
};

const DEFAULT_COUPONS = [];

function isCouponApplicable(coupon, context) {
  return false;
}

function evaluateFlightQuotes(flightItem, activeCoupons = []) {
  const {
    baseFare,
    taxAmount,
    cabinClass,
    tripType,
    airlineCode,
    isSameAirline = true
  } = flightItem;

  const rawTotalPrice = baseFare + taxAmount;
  const platformQuotes = [];

  // 判断是否为跨航司
  const isMultiAirline = airlineCode === 'MULTI' || isSameAirline === false;

  // 1. 携程旅行：无论同航司还是跨航司，OTA 均支持直接出票
  platformQuotes.push({
    platformId: 'ctrip',
    platformName: '携程旅行',
    shortName: '携程官方',
    color: PLATFORMS.ctrip.color,
    badgeBg: PLATFORMS.ctrip.badgeBg,
    isAvailable: true,
    rawTotalPrice,
    baseFare,
    taxAmount,
    totalDiscount: 0,
    finalNetPrice: rawTotalPrice,
    appliedCoupons: [],
    formulaText: isMultiAirline ? '携程独家组合特价 (分开出票)' : '携程官方往返打包直连出票',
    bookingUrl: PLATFORMS.ctrip.bookingUrl('PVG', 'MXP', '2027-04-10', 'MXP', 'PVG', '2027-04-24')
  });

  // 2. 航司官网直销：如果是跨航司组合，航司官网无法出售其他航司航段
  if (isMultiAirline) {
    platformQuotes.push({
      platformId: 'airline_direct',
      platformName: '航司官方直销',
      shortName: '航司官网',
      color: PLATFORMS.airline_direct.color,
      badgeBg: PLATFORMS.airline_direct.badgeBg,
      isAvailable: false,
      statusText: '不支持跨航司拼单',
      rawTotalPrice: null,
      baseFare: null,
      taxAmount: null,
      totalDiscount: 0,
      finalNetPrice: null,
      appliedCoupons: [],
      formulaText: '航司官网仅售本航司纯直飞往返，无法出其他航司回程票',
      bookingUrl: 'https://www.airchina.com.cn/'
    });
  } else {
    const airlineName = airlineCode === 'CA' ? '中国国航官方直销' : (airlineCode === 'MU' ? '中国东航官方直销' : '航司官方直销');
    platformQuotes.push({
      platformId: 'airline_direct',
      platformName: airlineName,
      shortName: '航司官网',
      color: PLATFORMS.airline_direct.color,
      badgeBg: PLATFORMS.airline_direct.badgeBg,
      isAvailable: true,
      rawTotalPrice,
      baseFare,
      taxAmount,
      totalDiscount: 0,
      finalNetPrice: rawTotalPrice,
      appliedCoupons: [],
      formulaText: '航司官方App/官网直营同价同票号',
      bookingUrl: PLATFORMS.airline_direct.bookingUrl(airlineCode)
    });
  }

  // 3. Google Flights：跨航司拆单不被 Google Flights 支持
  if (isMultiAirline) {
    platformQuotes.push({
      platformId: 'google_flights',
      platformName: 'Google Flights',
      shortName: 'Google比价',
      color: PLATFORMS.google_flights.color,
      badgeBg: PLATFORMS.google_flights.badgeBg,
      isAvailable: false,
      statusText: '不支持跨航司拆单',
      rawTotalPrice: null,
      baseFare: null,
      taxAmount: null,
      totalDiscount: 0,
      finalNetPrice: null,
      appliedCoupons: [],
      formulaText: 'Google Flights 国际 GDS 暂不支持国航与东航跨联盟拆单直飞',
      bookingUrl: 'https://www.google.com/travel/flights?hl=zh-CN&gl=CN&curr=CNY'
    });
  } else {
    platformQuotes.push({
      platformId: 'google_flights',
      platformName: 'Google Flights',
      shortName: 'Google比价',
      color: PLATFORMS.google_flights.color,
      badgeBg: PLATFORMS.google_flights.badgeBg,
      isAvailable: true,
      rawTotalPrice,
      baseFare,
      taxAmount,
      totalDiscount: 0,
      finalNetPrice: rawTotalPrice,
      appliedCoupons: [],
      formulaText: '国际GDS航线收录比价参考',
      bookingUrl: PLATFORMS.google_flights.bookingUrl('PVG', 'MXP', '2027-04-10', 'MXP', 'PVG', '2027-04-24')
    });
  }

  const bestPlatform = platformQuotes[0]; // 始终是携程

  return {
    rawTotalPrice,
    baseFare,
    taxAmount,
    bestPlatform,
    allPlatforms: platformQuotes
  };
}

module.exports = {
  PLATFORMS,
  DEFAULT_COUPONS,
  isCouponApplicable,
  evaluateFlightQuotes
};
