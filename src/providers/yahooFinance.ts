/**
 * providers/yahooFinance.ts — Yahoo Finance v8 chart implementation
 *
 * fetchPriceData — v8/finance/chart (5年・週足レンジ)
 *
 * API キー不要。
 */

/** 市場ごとのティッカーサフィックス */
const MARKET_SUFFIX: Record<Market, string> = {
  TSE:    '.T',
  NYSE:   '',
  NASDAQ: '',
};

/** Yahoo Finance v8 chart レスポンスの必要部分 */
interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: Array<number | null>;
          high:  Array<number | null>;
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

class YahooFinanceProvider implements StockProvider {
  readonly supportedMarkets: ReadonlyArray<Market> = ['TSE', 'NYSE', 'NASDAQ'];

  fetchPriceData(stock: StockConfig, _lookbackDays: number): PriceData | null {
    const ticker = `${stock.symbol}${MARKET_SUFFIX[stock.market]}`;
    const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1wk&range=5y`;

    const raw = this.fetchChart(url);
    if (!raw) return null;

    return this.parseChart(raw, stock.symbol);
  }

  private fetchChart(url: string): YahooChartResponse | null {
    let httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse;
    try {
      httpResponse = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
    } catch (e) {
      Logger.log(`[yahoo] fetch error: ${(e as Error).message}`);
      return null;
    }

    if (httpResponse.getResponseCode() !== 200) {
      Logger.log(`[yahoo] HTTP ${httpResponse.getResponseCode()} for ${url}`);
      return null;
    }

    try {
      return JSON.parse(httpResponse.getContentText()) as YahooChartResponse;
    } catch (e) {
      Logger.log(`[yahoo] JSON parse error: ${(e as Error).message}`);
      return null;
    }
  }

  private parseChart(raw: YahooChartResponse, symbol: string): PriceData | null {
    if (!raw.chart.result || raw.chart.result.length === 0) {
      Logger.log(`[yahoo] チャートデータなし: ${symbol}`);
      return null;
    }

    const result     = raw.chart.result[0];
    const timestamps = result.timestamp;
    const closes     = result.indicators.quote[0].close;
    const highs      = result.indicators.quote[0].high;

    if (!timestamps?.length) {
      Logger.log(`[yahoo] タイムスタンプが空: ${symbol}`);
      return null;
    }

    let windowHigh     = -Infinity;
    let windowHighDate = '';
    let currentPrice: number | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      const high  = highs[i];

      if (close === null || high === null) continue; // 休場日・欠損をスキップ

      if (high > windowHigh) {
        windowHigh = high;
        windowHighDate = Utilities.formatDate(
          new Date(timestamps[i] * 1000),
          'Asia/Tokyo',
          'yyyy-MM-dd',
        );
      }

      currentPrice = close;
    }

    if (currentPrice === null || windowHigh === -Infinity) {
      Logger.log(`[yahoo] 有効な価格データなし: ${symbol}`);
      return null;
    }

    return {
      currentPrice,
      highPrice:  windowHigh,
      highDate:   windowHighDate,
      dropPct:    ((currentPrice - windowHigh) / windowHigh) * 100,
    };
  }
}
