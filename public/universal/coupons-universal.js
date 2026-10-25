/**
 * 全球/全国通用版 — 分级优惠券与平台促销引擎
 * 严格按获取门槛分为 3 级：
 *   🟢 PUBLIC_FREE     : 人人免费可领 · 公开普惠（默认开启，0门槛）
 *   🟡 LIMITED_OR_BANK : 限时抢券 / 银行卡支付活动（按需勾选）
 *   🟣 VIP_EXCLUSIVE   : 付费/等级会员专属（默认关闭！拥有 88VIP / 携程钻卡等再开启，绝不虚标低价）
 */

const UNIVERSAL_PLATFORMS = {
  ctrip: {
    id: 'ctrip',
    name: '携程旅行',
    shortName: '携程',
    color: '#2577e3'
  },
  fliggy: {
    id: 'fliggy',
    name: '飞猪旅行',
    shortName: '飞猪',
    color: '#ff6a00'
  },
  qunar: {
    id: 'qunar',
    name: '去哪儿旅行',
    shortName: '去哪儿',
    color: '#00bcd4'
  },
  tongcheng: {
    id: 'tongcheng',
    name: '同程旅行',
    shortName: '同程',
    color: '#18b566'
  },
  airline_direct: {
    id: 'airline_direct',
    name: '航司官方App/官网',
    shortName: '航司直营',
    color: '#7c3aed'
  },
  google_flights: {
    id: 'google_flights',
    name: 'Google Flights / Trip.com',
    shortName: '国际比价',
    color: '#0f9d58'
  }
};

const ACCESS_TIER_META = {
  PUBLIC_FREE: {
    code: 'PUBLIC_FREE',
    badge: '🟢 人人免费可领',
    title: '公开普惠券（0门槛 · 人人都能领 · 默认计入到手价）',
    color: '#10b981'
  },
  LIMITED_OR_BANK: {
    code: 'LIMITED_OR_BANK',
    badge: '🟡 支付立减/定时抢',
    title: '银行卡支付活动 & 平台定时抢券（符合条件可勾选）',
    color: '#f59e0b'
  },
  VIP_EXCLUSIVE: {
    code: 'VIP_EXCLUSIVE',
    badge: '🟣 会员专属(默认关)',
    title: '88VIP / 携程钻卡 / 特定身份专属券（默认不计入，有会员再勾选）',
    color: '#a855f7'
  }
};

const UNIVERSAL_DEFAULT_COUPONS = [
  // ==================== 🟢 第一级：人人免费可领（默认开启） ====================
  {
    id: 'pub_qunar_intl_120',
    accessTier: 'PUBLIC_FREE',
    scope: 'INTL', // INTL=国际/港澳台, DOMESTIC=国内, ALL=通用
    platform: 'qunar',
    name: '去哪儿国际机票公开领券满3000-120',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3000,
    discountAmount: 120,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '打开去哪儿App → 首页点击「国际/港澳台机票」→ 顶部领券中心直接免费领取（所有注册用户可领）'
  },
  {
    id: 'pub_qunar_dom_35',
    accessTier: 'PUBLIC_FREE',
    scope: 'DOMESTIC',
    platform: 'qunar',
    name: '去哪儿国内机票比价直减券满600-35',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 600,
    discountAmount: 35,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '去哪儿App/小程序 → 机票频道弹窗或底部「领券中心」免费一键领取'
  },
  {
    id: 'pub_ctrip_multi_130',
    accessTier: 'PUBLIC_FREE',
    scope: 'INTL',
    platform: 'ctrip',
    name: '携程国际往返/开口程联订公开立减',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 3500,
    discountAmount: 130,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '携程App → 国际机票搜「往返」或「多程(缺口程)」时系统自动发放或页面顶部一键领券'
  },
  {
    id: 'pub_ctrip_dom_30',
    accessTier: 'PUBLIC_FREE',
    scope: 'DOMESTIC',
    platform: 'ctrip',
    name: '携程国内往返机票组合立减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 800,
    discountAmount: 30,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '携程App → 国内机票频道领券中心免费领取'
  },
  {
    id: 'pub_tongcheng_all_90',
    accessTier: 'PUBLIC_FREE',
    scope: 'INTL',
    platform: 'tongcheng',
    name: '同程微信端国际机票公开满减券',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 2800,
    discountAmount: 100,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '微信「服务 → 火车票机票(同程)」→ 国际机票顶部横幅免费领取'
  },
  {
    id: 'pub_airline_app_direct',
    accessTier: 'PUBLIC_FREE',
    scope: 'ALL',
    platform: 'airline_direct',
    name: '航司官方App注册会员直减 4% (会员日最高8%)',
    category: 'airline_promo',
    type: 'percentage_base',
    discountRate: 0.04,
    maxDiscount: 400,
    minSpend: 500,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '下载国航/东航/南航/海航/川航/吉祥官方App免费注册实名会员，购票自带「官网直减」标签；每月会员日(东航9/18日、南航28日、国航同月同日、海航8日)更享92~95折'
  },
  {
    id: 'pub_foreign_airline_code',
    accessTier: 'PUBLIC_FREE',
    scope: 'INTL',
    platform: 'airline_direct',
    name: '外航官网公开银联/支付宝优惠码 (-¥180)',
    category: 'airline_promo',
    type: 'threshold_minus',
    minSpend: 3800,
    discountAmount: 180,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: true,
    howToGet: '卡航/阿联酋航空/新航/汉莎/国泰中国官网活动页公开展示的 Promo Code（如银联 UNIONPAY / 支付宝活动码），任何人输入均可立减'
  },

  // ==================== 🟡 第二级：银行卡支付立减 / 定时抢券 ====================
  {
    id: 'lim_bank_unionpay_50',
    accessTier: 'LIMITED_OR_BANK',
    scope: 'ALL',
    platform: 'ALL',
    name: '云闪付/支付宝/招行中行信用卡支付立减',
    category: 'payment_discount',
    type: 'threshold_minus',
    minSpend: 1500,
    discountAmount: 50,
    cabinLimit: 'ALL',
    enabled: true,
    stackableWithPayment: false,
    howToGet: '收银台付款时选择「云闪付 / 程支付 / 支付宝招行中行信用卡分期或满减」，满1500立减30~88元（按均值50元计）'
  },
  {
    id: 'lim_fliggy_thursday_220',
    accessTier: 'LIMITED_OR_BANK',
    scope: 'INTL',
    platform: 'fliggy',
    name: '飞猪周四福利日出境机票限时抢券 (满5000-220)',
    category: 'platform_promo',
    type: 'threshold_minus',
    minSpend: 5000,
    discountAmount: 220,
    cabinLimit: 'ALL',
    enabled: false, // 需周四定时抢，默认关闭避免误导
    stackableWithPayment: true,
    howToGet: '每周四 10:00 / 20:00 打开飞猪App「周四福利日」会场整点抢券，抢到后再勾选此项'
  },

  // ==================== 🟣 第三级：付费/等级会员专属（默认全部关闭！） ====================
  {
    id: 'vip_fliggy_88vip_intl',
    accessTier: 'VIP_EXCLUSIVE',
    scope: 'INTL',
    platform: 'fliggy',
    name: '淘宝/飞猪 88VIP 专享国际机票大额券 (满4000-180)',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 4000,
    discountAmount: 180,
    cabinLimit: 'ALL',
    enabled: false, // 默认关闭！有88VIP的用户手动开启
    stackableWithPayment: true,
    howToGet: '【需开通淘宝 88VIP】手淘 88VIP 中心 → 飞猪联名权益 → 领取国际机票满4000减180元专享券'
  },
  {
    id: 'vip_fliggy_88vip_dom',
    accessTier: 'VIP_EXCLUSIVE',
    scope: 'DOMESTIC',
    platform: 'fliggy',
    name: '淘宝/飞猪 88VIP 国内机票专享券 (满1000-50)',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 1000,
    discountAmount: 50,
    cabinLimit: 'ALL',
    enabled: false, // 默认关闭
    stackableWithPayment: true,
    howToGet: '【需开通淘宝 88VIP】飞猪App → 我的 → 88VIP专享权益包领取'
  },
  {
    id: 'vip_ctrip_diamond_biz',
    accessTier: 'VIP_EXCLUSIVE',
    scope: 'INTL',
    platform: 'ctrip',
    name: '携程钻卡/黑钻会员两舱专享券 (满10000-450)',
    category: 'platform_coupon',
    type: 'threshold_minus',
    minSpend: 10000,
    discountAmount: 450,
    cabinLimit: 'BUSINESS',
    enabled: false, // 默认关闭
    stackableWithPayment: true,
    howToGet: '【需携程钻石/金钻/黑钻等级】携程App → 会员中心 → 等级礼遇领取公务舱/头等舱满减券'
  }
];

function evaluateUniversalQuotes(flightItem, activeCoupons = UNIVERSAL_DEFAULT_COUPONS) {
  const { baseFare, taxAmount, cabinClass, isDomestic, airlineCode } = flightItem;
  const baseTotal = baseFare + taxAmount;
  const routeScope = isDomestic ? 'DOMESTIC' : 'INTL';

  const platformQuotes = [];

  for (const [platformId, platformMeta] of Object.entries(UNIVERSAL_PLATFORMS)) {
    const rawTotalPrice = baseTotal;
    const adjustedBaseFare = baseFare;

    const matchingMain = [];
    const matchingPayment = [];

    for (const coupon of activeCoupons) {
      if (!coupon.enabled) continue;
      if (coupon.platform !== 'ALL' && coupon.platform !== platformId) continue;
      if (coupon.scope && coupon.scope !== 'ALL' && coupon.scope !== routeScope) continue;
      if (rawTotalPrice < (coupon.minSpend || 0)) continue;
      if (coupon.cabinLimit && coupon.cabinLimit !== 'ALL' && coupon.cabinLimit !== cabinClass) continue;

      let discount = 0;
      if (coupon.type === 'threshold_minus') {
        discount = Number(coupon.discountAmount) || 0;
      } else if (coupon.type === 'percentage_base') {
        discount = Math.min(
          Math.round(adjustedBaseFare * (coupon.discountRate || 0.04)),
          coupon.maxDiscount || 400
        );
      }
      if (discount <= 0) continue;

      if (coupon.category === 'payment_discount') {
        matchingPayment.push({ coupon, discount });
      } else {
        matchingMain.push({ coupon, discount });
      }
    }

    matchingMain.sort((a, b) => b.discount - a.discount);
    matchingPayment.sort((a, b) => b.discount - a.discount);

    const bestMain = matchingMain[0] || null;
    const bestPayment =
      (!bestMain || bestMain.coupon.stackableWithPayment !== false) && matchingPayment[0]
        ? matchingPayment[0]
        : null;

    const appliedCoupons = [];
    let totalDiscount = 0;

    if (bestMain) {
      appliedCoupons.push({
        id: bestMain.coupon.id,
        name: bestMain.coupon.name,
        amount: bestMain.discount,
        accessTier: bestMain.coupon.accessTier
      });
      totalDiscount += bestMain.discount;
    }
    if (bestPayment) {
      appliedCoupons.push({
        id: bestPayment.coupon.id,
        name: bestPayment.coupon.name,
        amount: bestPayment.discount,
        accessTier: bestPayment.coupon.accessTier
      });
      totalDiscount += bestPayment.discount;
    }

    const finalNetPrice = Math.max(180, rawTotalPrice - totalDiscount);

    platformQuotes.push({
      platformId,
      platformName: platformMeta.name,
      shortName: platformMeta.shortName,
      color: platformMeta.color,
      rawTotalPrice,
      baseFare: adjustedBaseFare,
      taxAmount,
      totalDiscount,
      finalNetPrice,
      appliedCoupons,
      formulaText:
        appliedCoupons.length > 0
          ? `含税 ¥${rawTotalPrice} - ${appliedCoupons.map(c => `${c.name}(¥${c.amount})`).join(' - ')} = 实付 ¥${finalNetPrice}`
          : `含税裸票价 ¥${rawTotalPrice}（无额外券抵扣）`
    });
  }

  platformQuotes.sort((a, b) => a.finalNetPrice - b.finalNetPrice);
  return {
    bestPlatform: platformQuotes[0],
    allPlatforms: platformQuotes
  };
}

window.UNIVERSAL_PLATFORMS = UNIVERSAL_PLATFORMS;
window.ACCESS_TIER_META = ACCESS_TIER_META;
window.UNIVERSAL_DEFAULT_COUPONS = UNIVERSAL_DEFAULT_COUPONS;
window.evaluateUniversalQuotes = evaluateUniversalQuotes;
