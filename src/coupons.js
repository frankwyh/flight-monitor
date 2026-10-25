/**
 * 平台优惠活动、优惠券及支付立减计算引擎
 * 支持：携程、飞猪、去哪儿、同程、航司直营(国航/东航/外航官网)、Google Flights / Trip.com
 *
 * 优惠券分级体系（严格规范，杜绝虚假低价）：
 * 🟢 PUBLIC_FREE (人人免费可领 · 公开普惠) -> 默认开启 (enabled: true)
 * 🟡 LIMITED_OR_BANK (银行卡支付立减 / 限时整点抢) -> 默认开启 (enabled: true)，但清晰标注
 * 🟣 VIP_EXCLUSIVE (88VIP / 携程钻卡等付费或高门槛专属) -> 默认关闭 (enabled: false)
 */

const PLATFORMS = {
  ctrip: {
    id: 'ctrip',
    name: '携程旅行',
    shortName: '携程',
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
        return `https://flights.ctrip.com/international/search/round-${d}-${a}?depdate=${date}_${retDate}`;
      }
      return `https://flights.ctrip.com/international/search/oneway-${d}-${a}?depdate=${date}`;
    }
  },
  fliggy: {
    id: 'fliggy',
    name: '飞猪旅行',
    shortName: '飞猪',
    color: '#ff6a00',
    badgeBg: '#fff1e6',
    bookingUrl: (dep, arr, date, retDep, retArr, retDate) => {
      const d = dep || 'SHA';
      const a = arr || 'MXP';
      if (retDate) {
        return `https://www.fliggy.com/flight/`;
      }
      return `https://www.fliggy.com/flight/`;
    }
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
        LX: 'https://www.swiss.com/cn/zh/homepage',
        EY: 'https://www.etihad.com/zh-cn/'
      };
      return urls[airlineCode] || 'https://www.google.com/travel/flights';
    }
  },
  google_flights: {
    id: 'google_flights',
    name: 'Google Flights',
    shortName: 'Google比价',
    color: '#0f9d58',
    badgeBg: '#e6f4ea',
    bookingUrl: (dep, arr, date, retDep, retArr, retDate) => {
      const q = retDate
        ? `${dep || 'SHA'} to ${arr || 'MXP'} ${date} return ${retDep || 'FCO'} to ${retArr || 'SHA'} ${retDate}`
        : `${dep || 'SHA'} to ${arr || 'MXP'} ${date}`;
      return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=zh-CN&gl=CN&curr=CNY`;
    }
  }
};

/**
 * 平台优惠券库（按门槛透明分级）
 */
const DEFAULT_COUPONS = [
  // ==================== 🟢 PUBLIC_FREE (人人免费可领) ====================
  {
    id: 'fliggy_public_intl_100',
    tier: 'PUBLIC_FREE',
    platform: 'fliggy',
    name: '飞猪出境机票公开普惠券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3000,
    discountAmount: 100,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '人人可领：飞猪App首页搜索「国际机票」天天领满3000减100元普惠券',
    howToGet: '打开飞猪App -> 机票频道 -> 国际机票 -> 顶部「出境补贴天天领」点击即领，无需任何会员资格'
  },
  {
    id: 'ctrip_public_multi_120',
    tier: 'PUBLIC_FREE',
    platform: 'ctrip',
    name: '携程国际多程/往返立减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3500,
    discountAmount: 120,
    cabinLimit: 'ALL',
    tripTypeLimit: ['open_jaw', 'round_trip'],
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '人人可领：携程国际往返/多程联订专项立减满3500减120元',
    howToGet: '打开携程旅行App -> 机票 -> 国际/港澳台 -> 领券中心一键领取'
  },
  {
    id: 'qunar_public_80',
    tier: 'PUBLIC_FREE',
    platform: 'qunar',
    name: '去哪儿国际机票新人/普惠券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 2500,
    discountAmount: 80,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    description: '人人可领：去哪儿App国际机票频道直接弹出满2500减80元立减券',
    howToGet: '去哪儿旅行App -> 机票首页弹窗直接领取'
  },
  {
    id: 'airline_website_member',
    tier: 'PUBLIC_FREE',
    platform: 'airline_direct',
    name: '航司官网新会员注册立减券',
    category: 'airline_promo',
    type: 'threshold_minus',
    minSpend: 3000,
    discountAmount: 100,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: ['CA', 'MU', 'QR', 'EK', 'EY', 'LH', 'AY', 'TK', 'LX'],
    enabled: true,
    stackableWithPayment: true,
    description: '免费注册：国航知音、东航万里行、阿联酋航空Skywards或卡航Privilege Club官网免费注册会员即送立减优惠',
    howToGet: '航司官网免费注册常旅客会员账号，在预订页面输入会员号或新会员Promo Code'
  },

  // ==================== 🟡 LIMITED_OR_BANK (银行卡支付/限时抢) ====================
  {
    id: 'payment_bank_crossborder',
    tier: 'LIMITED_OR_BANK',
    platform: 'ALL',
    name: '银行卡/信用卡跨境出行立减',
    category: 'payment_discount',
    type: 'threshold_minus',
    minSpend: 3000,
    discountAmount: 50,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: true,
    stackableWithPayment: false,
    description: '招行/中行/工行/银联云闪付卡支付立减50元（名额有限，先到先得）',
    howToGet: '收银台选择云闪付或指定信用卡快捷支付，满额自动扣减'
  },
  {
    id: 'fliggy_thursday_flash',
    tier: 'LIMITED_OR_BANK',
    platform: 'fliggy',
    name: '飞猪周四闪促大额满减券',
    category: 'platform_promo',
    type: 'threshold_minus',
    minSpend: 5000,
    discountAmount: 200,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: false,
    stackableWithPayment: true,
    description: '限时抢：飞猪每周四上午10:00限时限量抢国际长途满5000减200元券',
    howToGet: '周四上午10点飞猪App「周四机票狂欢节」活动会场手动抢券'
  },

  // ==================== 🟣 VIP_EXCLUSIVE (付费/高门槛会员专属 · 默认关闭) ====================
  {
    id: 'fliggy_88vip_intl',
    tier: 'VIP_EXCLUSIVE',
    platform: 'fliggy',
    name: '飞猪 88VIP 专享国际机票满减',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 4000,
    discountAmount: 180,
    cabinLimit: 'ALL',
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: false, // ⚠️ 默认关闭！非人人均有，必须手动开启
    stackableWithPayment: true,
    description: '【88VIP专属】淘宝88VIP会员专享每月国际机票满4000减180元券',
    howToGet: '需淘气值≥1000花88元开通淘宝88VIP，在飞猪「我的-88VIP权益」内领取'
  },
  {
    id: 'ctrip_diamond_biz',
    tier: 'VIP_EXCLUSIVE',
    platform: 'ctrip',
    name: '携程黑钻/金钻公务舱专享券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 10000,
    discountAmount: 400,
    cabinLimit: ['BUSINESS', 'FIRST'],
    tripTypeLimit: 'ALL',
    AirlineLimit: 'ALL',
    enabled: false, // ⚠️ 默认关闭！需携程高等级会员
    stackableWithPayment: true,
    description: '【携程钻卡专属】携程金钻、黑钻会员专享两舱满10000减400元大额券',
    howToGet: '需携程年度消费达标升级金钻/黑钻会员，在会员俱乐部权益中心领取'
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
 * 计算单张优惠券抵扣金额
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
 * 为给定的航班方案计算各大平台真实报价、可用优惠券叠加及最优实付到手价
 * 注意：baseTotal 必须为真实 GDS 含税全价，不再人为下调平台报价！
 */
function evaluateFlightQuotes(flightItem, activeCoupons = DEFAULT_COUPONS) {
  const {
    baseFare,
    taxAmount,
    cabinClass,
    tripType,
    airlineCode
  } = flightItem;

  const baseTotal = baseFare + taxAmount;

  // 严格杜绝虚假负差价！各平台裸票价统一基于真实 GDS 含税底价
  const platformQuotes = [];

  for (const [platformId, platformMeta] of Object.entries(PLATFORMS)) {
    // 真实平台裸票价：全部基于真实含税全价，无负向虚假抵扣
    const rawTotalPrice = baseTotal;
    const adjustedBaseFare = baseFare;

    const context = {
      platformId,
      rawTotalPrice,
      baseFare: adjustedBaseFare,
      taxAmount,
      cabinClass,
      tripType,
      airlineCode
    };

    // 筛选当前平台可用的主券（取最优1张）+ 支付立减券（可叠加1张）
    const matchingMainCoupons = [];
    const matchingPaymentCoupons = [];

    for (const coupon of (activeCoupons || DEFAULT_COUPONS)) {
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
        tier: bestMain.coupon.tier || 'PUBLIC_FREE',
        category: bestMain.coupon.category,
        howToGet: bestMain.coupon.howToGet || ''
      });
      totalDiscount += bestMain.discount;
    }

    if (bestPayment) {
      appliedCoupons.push({
        id: bestPayment.coupon.id,
        name: bestPayment.coupon.name,
        amount: bestPayment.discount,
        tier: bestPayment.coupon.tier || 'LIMITED_OR_BANK',
        category: bestPayment.coupon.category,
        howToGet: bestPayment.coupon.howToGet || ''
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
          ? `OTA裸票含税 ¥${rawTotalPrice} - ${appliedCoupons.map(c => `${c.name}(¥${c.amount})`).join(' - ')} = 实付预估 ¥${finalNetPrice}`
          : `OTA裸票含税 ¥${rawTotalPrice}（全网基准价）`
    });
  }

  // 排序：先看折后到手预估价，若相同则看平台信用
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
