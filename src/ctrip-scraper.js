/**
 * 携程中意直飞专线 Playwright 真实浏览器无头/有头爬虫 (穿透 WhaleGuard)
 */

const { chromium } = require('playwright');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(__dirname, '..', '.ctrip_browser_profile');

/**
 * 抓取携程上海 ⇄ 米兰/罗马 真实直飞在售运价
 */
async function scrapeCtripDirectFlights(outDate = '2027-04-10', inDate = '2027-04-24') {
  console.log(`🚀 [Ctrip Scraper] 启动本地真实 Chrome 抓取携程直飞报价 (${outDate} ⇄ ${inDate})...`);
  let context = null;

  try {
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      executablePath: CHROME_PATH,
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-infobars',
        '--window-size=1280,800'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: 1280, height: 800 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    });

    const page = context.pages()[0] || await context.newPage();

    // 1. 先访问首页初始化会话与基础 Cookie
    await page.goto('https://www.ctrip.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // 2. 访问上海 ⇄ 米兰往返搜索页
    const searchUrl = `https://flights.ctrip.com/international/search/round-SHA-MXP?depdate=${outDate}_${inDate}&cabin=y_s&adult=1&child=0&infant=0`;
    console.log('[Ctrip Scraper] 访问携程国际搜索页:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // 3. 等待航班卡片渲染
    console.log('[Ctrip Scraper] 等待携程实时运价卡片渲染...');
    try {
      await page.waitForSelector('.flight-item, [class*="flight-item"]', { timeout: 18000 });
      console.log('[Ctrip Scraper] 找到航班卡片元素！');
    } catch (e) {
      console.log('[Ctrip Scraper] waitForSelector 超时，继续尝试提取已加载内容...');
    }
    await page.waitForTimeout(3000);

    // 4. 解析 DOM 提取直飞航线真实价格
    const flightResults = await page.evaluate(() => {
      const items = {};
      const rows = document.querySelectorAll('.flight-item, [class*="flight-item"]');
      rows.forEach(r => {
        const text = r.innerText || '';
        // 匹配航司与航班号
        let flightNo = null;
        if (text.includes('CA967')) flightNo = 'CA967';
        else if (text.includes('MU243')) flightNo = 'MU243';
        else if (text.includes('MU787')) flightNo = 'MU787';

        if (flightNo) {
          // 提取价格数字 (如 ¥8126起 或 ¥7102起 或 ¥9245)
          const priceMatch = text.match(/¥\s*(\d[\d,]*)/);
          if (priceMatch) {
            const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            if (price > 1000) {
              items[flightNo] = {
                flightNo,
                price,
                rawText: text.replace(/\n+/g, ' | ')
              };
            }
          }
        }
      });
      return items;
    });

    console.log('[Ctrip Scraper] 提取到的携程直飞实时报价:', flightResults);
    return flightResults;
  } catch (err) {
    console.warn('[Ctrip Scraper] 抓取失败或超时:', err.message);
    return null;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

module.exports = {
  scrapeCtripDirectFlights
};
