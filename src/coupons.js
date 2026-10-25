/**
 * 平台优惠活动、优惠券及支付立减计算引擎
 * 支持：携程、飞猪、去哪儿、同程、航司直营(国航/东航/吉祥/外航官网)、Google Flights/Trip.com
 */

const PLATFORMS = {
  ctrip: {
    id: 'ctrip',
    name: '携程旅行',
    shortName: '携程',
    color: '#2577e3',
    badgeBg: '#e8f2ff',
    urlTemplate: (dep, arr, date, retDep, retArr, retDate) =>
      retDate
        ? `https://flights.ctrip.com/international/search/api/search/multi?dep=${dep}&arr=${arr}&date=${date}&retDep=${retDep}&retArr=${retArr}&retDate=${retDate}`
        : `https://flights.ctrip.com/international/search/oneway-${dep.toLowerCase()}-${arr.toLowerCase()}?depdate=${date}`,
    bookingUrl: (dep, arr, date, retDep, retArr, retDate) =>
      retDate && (dep !== retArr || arr !== retDep)
        ? `https://flights.ctrip.com/international/search/multicity`
        : retDate
        ? `https://flights.ctrip.com/international/search/round-${dep.toLowerCase()}-${arr.toLowerCase()}?depdate=${date}_${retDate}`
        : `https://flights.ctrip.com/international/search/oneway-${dep.toLowerCase()}-${arr.toLowerCase()}?depdate=${date}`
  },
  fliggy: {
    id: 'fliggy',
    name: '飞猪旅行',
    shortName: '飞猪',
    color: '#ff6a00',
    badgeBg: '#fff1e6',
    bookingUrl: () => `https://www.fliggy.com/`
  },
  qunar: {
    id: 'qunar',
    name: '去哪儿旅行',
    shortName: '去哪儿',
    color: '#00bcd4',
    badgeBg: '#e0f7fa',
    bookingUrl: () => `https://flight.qunar.com/`
  },
  tongcheng: {
    id: 'tongcheng',
    name: '同程旅行',
    shortName: '同程',
    color: '#18b566',
    badgeBg: '#e8f8f0',
    bookingUrl: () => `https://www.ly.com/iflight/`
  },
  airline_direct: {
    id: 'airline_direct',
    name: '航司官网/App',
    shortName: '航司直营',
    color: '#7c3aed',
    badgeBg: '#f3e8ff',
    bookingUrl: (dep, arr, date, retDep, retArr, retDate, airlineCode) => {
      const urls = {
        CA: 'https://www.airchina.com.cn/',
        MU: 'https://www.ceair.com/',
        HO: 'https://www.juneyaoair.com/',
        QR: 'https://www.qatarairways.com/zh-cn/homepage.html',
        EK: 'https://www.emirates.com/cn/chinese/',
        LH: 'https://www.lufthansa.com/cn/zh/homepage',
        AF: 'https://wwws.airfrance.com.cn/',
        KL: 'https://www.klm.com.cn/',
        TK: 'https://www.turkishairlines.com/zh-cn/',
        CX: 'https://www.cathaypacific.com/cx/sc_CN.html',
        AY: 'https://www.finnair.com/cn-zh',
        LX: 'https://www.swiss.com/cn/zh/homepage'
      };
      return urls[airlineCode] || 'https://www.google.com/travel/flights';
    }
  },
  google_flights: {
    id: 'google_flights',
    name: 'Google Flights / Trip.com',
    shortName: 'Google比价',
    color: '#0f9d58',
    badgeBg: '#e6f4ea',
    bookingUrl: () => `https://www.trip.com/flights/`
  }
};

/**
 * 默认内置平台优惠券与促销规则库
 * 用户可在前端开关自己适用的优惠券，或新增自定义优惠券
 */
const DEFAULT_COUPONS = [
  {
    id: 'fliggy_88vip_intl',
    platform: 'fliggy',
    name: '飞猪 88VIP 出境机票专享券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 4000,
    discountAmount: 180,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '88VIP会员每月可领国际机票满4000减180元大额券（公务舱/开口程通用）'
  },
  {
    id: 'fliggy_thursday_flash',
    platform: 'fliggy',
    name: '飞猪周四出境闪促膨胀券',
    category: 'platform_promo',
    type: 'threshold_minus',
    minSpend: 6000,
    discountAmount: 260,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '欧洲长途航线满6000减260元（与88VIP券择优使用一张平台券）'
  },
  {
    id: 'ctrip_europe_multi',
    platform: 'ctrip',
    name: '携程欧洲多程/开口联订立减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3800,
    discountAmount: 160,
    cabinLimit: 'ALL',
    tripTypeLimit: ['open_jaw', 'round_trip'],
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '携程国际往返/缺口程联订专项补贴满3800减160元'
  },
  {
    id: 'ctrip_diamond_biz',
    platform: 'ctrip',
    name: '携程黑钻/金钻两舱专享立减',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 10000,
    discountAmount: 450,
    cabinLimit: ['BUSINESS', 'FIRST'],
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '国际公务舱/头等舱满10000减450元专享大额券'
  },
  {
    id: 'qunar_lowprice_150',
    platform: 'qunar',
    name: '去哪儿国际机票比价直减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3500,
    discountAmount: 150,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '去哪儿App国际机票频道领券满3500减150元'
  },
  {
    id: 'qunar_single_80',
    platform: 'qunar',
    name: '去哪儿国际单程立减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 1800,
    discountAmount: 80,
    cabinLimit: 'ALL',
    tripTypeLimit: ['one_way'],
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '单程机票满1800减80元，适合拆分单买时每段分别抵扣'
  },
  {
    id: 'airline_ca_mu_ho_member',
    platform: 'airline_direct',
    name: '国航/东航/吉祥 App 会员日直减 5%',
    category: 'airline_promo',
    type: 'percentage_base',
    discountRate: 0.05, // 票面价直减5%（综合含税约减130~400元）
    maxDiscount: 500,
    minSpend: 2000,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: ['CA', 'MU', 'HO'],
    enabled: true,
    stackableWithPayment: true,
    description: '东航每月9/18日、国航每月同月同日、吉祥每月25日会员日官网/App购票享票面95折+首单礼包'
  },
  {
    id: 'airline_foreign_promo',
    platform: 'airline_direct',
    name: '外航官网优惠码 (QR/EK/LH/TK/AY)',
    category: 'airline_promo',
    type: 'threshold_minus',
    minSpend: 4200,
    discountAmount: 220,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: ['QR', 'EK', 'LH', 'AF', 'KL', 'TK', 'AY', 'LX'],
    enabled: true,
    stackableWithPayment: true,
    description: '卡航/阿联酋/汉莎/土航中国区官网银联/支付宝专属Promo Code立减220元'
  },
  {
    id: 'payment_bank_crossborder',
    platform: 'ALL',
    name: '银行卡/支付立减 (招行/中行/银联/支付宝)',
    category: 'payment_discount',
    type: 'threshold_minus',
    minSpend: 3000,
    discountAmount: 60,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: false,
    description: '携程程支付/飞猪支付宝分期免息立减/银联云闪付满3000随机立减50~88元（按均值60元计）'
  },
  {
    id: 'tongcheng_intl_pass',
    platform: 'tongcheng',
    name: '同程国际机票省钱卡券包',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3200,
    discountAmount: 135,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '同程小程序国际机票满3200减135元叠加出行礼包'
  }
];

/**
 * 评估某张优惠券是否适用于当前航班方案
 */
function isCouponApplicable(coupon, context) {
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

/**
 * 计算单张优惠券在特定金额下的抵扣额
 */
function computeCouponDiscount(coupon, rawTotalPrice, baseFare) {
  if (coupon.type === 'threshold_minus') {
    return coupon.discountAmount || 0;
  }
  if (coupon.type === 'percentage_base') {
    const targetBase = baseFare || Math.round(rawTotalPrice * 0.65);
    const rawDisc = Math.round(targetBase * (coupon.discountRate || 0.05));
    return Math.min(rawDisc, coupon.maxDiscount || 9999);
  }
  if (coupon.type === 'percentage_total') {
    const rawDisc = Math.round(rawTotalPrice * (coupon.discountRate || 0.03));
    return Math.min(rawDisc, coupon.maxDiscount || 9999);
  }
  return 0;
}

/**
 * 为给定的航班方案计算各大平台报价、可用优惠券叠加及最优实付到手价
 */
function evaluateFlightQuotes(flightItem, activeCoupons = DEFAULT_COUPONS) {
  const {
    baseFare,
    taxAmount,
    cabinClass,
    tripType,
    airlineCode,
    platformMarkups = {}
  } = flightItem;

  const baseTotal = baseFare + taxAmount;

  // 各平台基于基准运价的渠道差价（有些平台代理返点低、有些官网直营无代理费）
  const defaultOffsets = {
    ctrip: 0,
    fliggy: 20,
    qunar: -35,
    tongcheng: -15,
    airline_direct: ['CA', 'MU', 'HO', 'QR', 'EK'].includes(airlineCode) ? -10 : 45,
    google_flights: -50
  };

  const platformQuotes = [];

  for (const [platformId, platformMeta] of Object.entries(PLATFORMS)) {
    const offset =
      platformMarkups[platformId] !== undefined
        ? platformMarkups[platformId]
        : defaultOffsets[platformId] || 0;

    // 根据舱位放大差价（公务舱不同代理差价更大）
    const cabinMultiplier = cabinClass === 'BUSINESS' ? 2.4 : cabinClass === 'PREMIUM_ECONOMY' ? 1.4 : 1;
    const rawTotalPrice = Math.max(800, Math.round(baseTotal + offset * cabinMultiplier));
    const adjustedBaseFare = Math.max(400, rawTotalPrice - taxAmount);

    const context = {
      platformId,
      rawTotalPrice,
      baseFare: adjustedBaseFare,
      taxAmount,
      cabinClass,
      tripType,
      airlineCode
    };

    // 筛选当前平台可用的平台券/航司券（同平台主券取最优1张）+ 支付立减券（可叠加1张）
    const matchingMainCoupons = [];
    const matchingPaymentCoupons = [];

    for (const coupon of activeCoupons) {
      if (!isCouponApplicable(coupon, context)) continue;
      const discount = computeCouponDiscount(coupon, rawTotalPrice, adjustedBaseFare);
      if (discount <= 0) continue;

      if (coupon.category === 'payment_discount') {
        matchingPaymentCoupons.push({ coupon, discount });
      } else {
        matchingMainCoupons.push({ coupon, discount });
      }
    }

    matchingMainCoupons.sort((a, b) => b.discount - a.discount);
    matchingPaymentCoupons.sort((a, b) => b.discount - a.discount);

    const bestMain = matchingMainCoupons[0] || null;
    const bestPayment =
      (!bestMain || bestMain.coupon.stackableWithPayment !== false) && matchingPaymentCoupons[0]
        ? matchingPaymentCoupons[0]
        : null;

    const appliedCoupons = [];
    let totalDiscount = 0;

    if (bestMain) {
      appliedCoupons.push({
        id: bestMain.coupon.id,
        name: bestMain.coupon.name,
        amount: bestMain.discount,
        category: bestMain.coupon.category
      });
      totalDiscount += bestMain.discount;
    }

    if (bestPayment) {
      appliedCoupons.push({
        id: bestPayment.coupon.id,
        name: bestPayment.coupon.name,
        amount: bestPayment.discount,
        category: bestPayment.coupon.category
      });
      totalDiscount += bestPayment.discount;
    }

    const finalNetPrice = Math.max(500, rawTotalPrice - totalDiscount);

    platformQuotes.push({
      platformId,
      platformName: platformMeta.name,
      shortName: platformMeta.shortName,
      color: platformMeta.color,
      badgeBg: platformMeta.badgeBg,
      rawTotalPrice,
      baseFare: adjustedBaseFare,
      taxAmount,
      totalDiscount,
      finalNetPrice,
      appliedCoupons,
      formulaText:
        appliedCoupons.length > 0
          ? `票面含税 ¥${rawTotalPrice} - ${appliedCoupons.map(c => `${c.name}(¥${c.amount})`).join(' - ')} = 实付 ¥${finalNetPrice}`
          : `票面含税 ¥${rawTotalPrice}（无额外券抵扣）`
    });
  }

  // 按折后实付到手价升序排列
  platformQuotes.sort((a, b) => a.finalNetPrice - b.finalNetPrice);

  const bestQuote = platformQuotes[0];
  const lowestRawQuote = [...platformQuotes].sort((a, b) => a.rawTotalPrice - b.rawTotalPrice)[0];

  return {
    bestPlatform: bestQuote,
    lowestRawPlatform: lowestRawQuote,
    allPlatforms: platformQuotes
  };
}

module.exports = {
  PLATFORMS,
  DEFAULT_COUPONS,
  evaluateFlightQuotes
};
