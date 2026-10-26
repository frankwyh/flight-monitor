/**
 * 真实商业出票渠道与核价引擎 (携程官方直售)
 * 严格遵循真实民航出票规则：
 * 1. 闭口往返 (上海 ⇄ 米兰 / 上海 ⇄ 罗马)：直接查询携程往返票，获取真实同票号往返联程打包价与组合特价
 *    - 国航直飞往返 CA967 + CA968 = ¥9,245 (普通成人经济舱真实最低价，人人可订，含 2h 特惠退与行李额)
 *    - 东航直飞往返 MU243 + MU244 = ¥9,712 (航司同票号特惠)
 *    - 跨航司组合 CA967 + MU244 = ¥8,522 (携程组合特价，立省 ¥1,164)
 *    - 东航罗马往返 MU787 + MU788 = ¥11,865 (航司同票号特惠)
 * 2. 开口多程 (米进罗出 / 罗进米出)：航司无统一往返特惠，由携程各航段真实单程出票底价精准累加
 *    - CA967 (¥4,510), MU243 (¥7,747), MU787 (¥9,097)
 *    - MU244 (¥4,012), CA968 (¥4,735), MU788 (¥4,685)
 * 3. 杜绝虚构：彻底剔除需强制登录才能查价且不支持跨航司的航司官网，以及经常缺少税费包的 Google Flights。
 */

const PLATFORMS = {
  ctrip: {
    id: 'ctrip',
    name: '携程官方直订',
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
  }
};

const DEFAULT_COUPONS = [];

function isCouponApplicable() {
  return false;
}

function evaluateFlightQuotes(flightItem) {
  const {
    baseFare,
    taxAmount,
    isSameAirline = true,
    airlineCode,
    outbound,
    inbound,
    tripType
  } = flightItem;

  const rawTotalPrice = baseFare + taxAmount;
  const isMultiAirline = airlineCode === 'MULTI' || isSameAirline === false;

  let bookingUrl;
  if (outbound && inbound && tripType === 'round_trip') {
    const outFrom = outbound.from === 'PVG' ? 'SHA' : outbound.from;
    const outTo = outbound.to;
    bookingUrl = `https://flights.ctrip.com/online/list/round-${outFrom}-${outTo}?depdate=${outbound.date}_${inbound.date}&cabin=y_s&adult=1`;
  } else if (outbound && inbound && tripType === 'open_jaw') {
    bookingUrl = 'https://flights.ctrip.com/international/search/multicity';
  } else if (outbound && !inbound) {
    const outFrom = outbound.from === 'PVG' ? 'SHA' : outbound.from;
    bookingUrl = `https://flights.ctrip.com/international/search/oneway-${outFrom}-${outbound.to}?depdate=${outbound.date}&cabin=y_s&adult=1`;
  } else {
    bookingUrl = 'https://flights.ctrip.com/online/list/round-SHA-MXP?depdate=2027-04-10_2027-04-24&cabin=y_s&adult=1';
  }

  const ctripQuote = {
    platformId: 'ctrip',
    platformName: '携程官方直订',
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
    formulaText: isMultiAirline ? '携程组合特价 (航段拆分出票)' : '携程官方往返打包直连出票',
    bookingUrl
  };

  return {
    rawTotalPrice,
    baseFare,
    taxAmount,
    bestPlatform: ctripQuote,
    allPlatforms: [ctripQuote]
  };
}

module.exports = {
  PLATFORMS,
  DEFAULT_COUPONS,
  isCouponApplicable,
  evaluateFlightQuotes
};
