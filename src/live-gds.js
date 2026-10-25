/**
 * 实时 GDS 运价抓取与解析引擎 (Google Flights Live + 真实全网运价)
 */

const { createFilter, getFlightsFromFilter, FlightData, Passengers } = require('google-flights-ts');

const AIRLINE_KEYWORD_MAP = {
  'Emirates': ['阿联酋航空'],
  'Qatar': ['卡塔尔航空'],
  'Etihad': ['阿提哈德航空'],
  'Turkish': ['土耳其航空'],
  'SWISS': ['瑞士国际航空', '瑞士航空'],
  'Lufthansa': ['汉莎航空'],
  'Austrian': ['奥地利航空'],
  'Finnair': ['芬兰航空'],
  'Air Serbia': ['塞尔维亚航空'],
  'THAI': ['泰国国际航空'],
  'Gulf Air': ['海湾航空'],
  'British Airways': ['英国航空'],
  'Air France': ['法国航空'],
  'EgyptAir': ['埃及航空'],
  'Air China': ['中国国际航空', '国航'],
  'China Eastern': ['中国东方航空', '东航']
};

/**
 * 将 12 小时制转换为 24 小时制 HH:mm
 * 例: "7:20 AM" -> "07:20", "12:15 PM" -> "12:15", "8:15 PM" -> "20:15"
 */
function parse12HourTime(timeStr) {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${min}`;
}

/**
 * 实时抓取单个航段的 Google Flights 运价
 */
async function fetchLiveSegmentFlights(from, to, date, tripType = 'one-way') {
  try {
    const filter = createFilter({
      flight_data: [new FlightData({ date, from_airport: from, to_airport: to })],
      trip: tripType,
      seat: 'economy',
      passengers: new Passengers({ adults: 1 })
    });

    const res = await getFlightsFromFilter(filter, {
      currency: 'CNY',
      request_options: {
        headers: {
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      }
    });

    if (!res || !Array.isArray(res.flights)) return [];

    const parsedFlights = [];
    for (const f of res.flights) {
      if (!f.price || f.price.includes('unavailable')) continue;
      const numMatch = f.price.match(/\d[\d,]*/);
      if (!numMatch) continue;
      const priceNum = parseInt(numMatch[0].replace(/,/g, ''), 10);
      if (isNaN(priceNum) || priceNum <= 0) continue;

      const depTimeMatch = f.departure ? f.departure.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i) : null;
      const depTime24 = depTimeMatch ? parse12HourTime(depTimeMatch[1]) : null;

      parsedFlights.push({
        rawName: f.name || '',
        stops: f.stops,
        price: priceNum,
        depTime24,
        duration: f.duration
      });
    }

    return parsedFlights;
  } catch (err) {
    console.warn(`[GDS Engine] 实时抓取 ${from}->${to} (${date}) 异常:`, err.message);
    return [];
  }
}

/**
 * 在实时列表中为指定航线模板匹配最新票价
 */
function findBestLivePrice(tpl, liveFlights) {
  if (!liveFlights || !liveFlights.length) return null;

  // 1. 优先根据时刻 + 航司关键词精确匹配
  for (const lf of liveFlights) {
    if (lf.stops !== tpl.stops) continue;

    // 检查航司关键词
    let airlineMatch = false;
    for (const [enKey, cnList] of Object.entries(AIRLINE_KEYWORD_MAP)) {
      if (cnList.some(name => tpl.airlineName.includes(name))) {
        if (lf.rawName.toLowerCase().includes(enKey.toLowerCase())) {
          airlineMatch = true;
          break;
        }
      }
    }
    if (!airlineMatch) continue;

    // 检查时间差（允许 ±30 分钟时刻微调）
    if (lf.depTime24 && tpl.depTime) {
      const [lh, lm] = lf.depTime24.split(':').map(Number);
      const [th, tm] = tpl.depTime.split(':').map(Number);
      const diffMin = Math.abs((lh * 60 + lm) - (th * 60 + tm));
      if (diffMin <= 45) {
        return lf.price;
      }
    }
  }

  // 2. 次优匹配：同航司同经停次数的最低实时票价
  for (const lf of liveFlights) {
    if (lf.stops !== tpl.stops) continue;
    for (const [enKey, cnList] of Object.entries(AIRLINE_KEYWORD_MAP)) {
      if (cnList.some(name => tpl.airlineName.includes(name))) {
        if (lf.rawName.toLowerCase().includes(enKey.toLowerCase())) {
          return lf.price;
        }
      }
    }
  }

  return null;
}

module.exports = {
  fetchLiveSegmentFlights,
  findBestLivePrice
};
