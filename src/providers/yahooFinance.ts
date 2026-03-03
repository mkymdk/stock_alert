/**
 * providers/yahooFinance.ts — Yahoo Finance v8 API implementation
 *
 * Handles both Japanese stocks (TSE → appends ".T" suffix) and
 * US stocks (NYSE / NASDAQ → no suffix).
 *
 * Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
 *           ?interval=1d&range=6mo
 *
 * No API key is required.
 */

/** Ticker suffix appended per market */
const MARKET_SUFFIX: Record<Market, string> = {
  TSE:    '.T',
  NYSE:   '',
  NASDAQ: '',
};

/** Shape of the relevant portion of the Yahoo Finance v8 response */
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

  fetchPriceData(stock: StockConfig, lookbackDays: number): PriceData | null {
    const suffix = MARKET_SUFFIX[stock.market];
    const ticker = `${stock.symbol}${suffix}`;
    const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=6mo`;

    const response = this.fetch(url);
    if (!response) return null;

    return this.parse(response, stock.symbol, lookbackDays);
  }

  private fetch(url: string): YahooChartResponse | null {
    let httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse;
    try {
      httpResponse = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
    } catch (e) {
      Logger.log(`[yahoo] UrlFetchApp error: ${(e as Error).message}`);
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

  private parse(
    raw: YahooChartResponse,
    symbol: string,
    lookbackDays: number,
  ): PriceData | null {
    if (!raw.chart.result || raw.chart.result.length === 0) {
      Logger.log(`[yahoo] No result data for ${symbol}`);
      return null;
    }

    const result     = raw.chart.result[0];
    const timestamps = result.timestamp;
    const closes     = result.indicators.quote[0].close;
    const highs      = result.indicators.quote[0].high;

    if (!timestamps?.length) {
      Logger.log(`[yahoo] Empty timestamp array for ${symbol}`);
      return null;
    }

    const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    let windowHigh     = -Infinity;
    let windowHighDate = '';
    let currentPrice: number | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      const tsMs  = timestamps[i] * 1000;
      const close = closes[i];
      const high  = highs[i];

      if (tsMs < cutoffMs) continue;       // Outside lookback window
      if (close === null || high === null) continue; // Holiday / missing data

      // Track the peak intraday high across the window
      if (high > windowHigh) {
        windowHigh = high;
        windowHighDate = Utilities.formatDate(
          new Date(tsMs),
          'Asia/Tokyo',
          'yyyy-MM-dd',
        );
      }

      // Last valid close is the "current" price
      currentPrice = close;
    }

    if (currentPrice === null || windowHigh === -Infinity) {
      Logger.log(`[yahoo] No valid price data in window for ${symbol}`);
      return null;
    }

    const dropPct = ((currentPrice - windowHigh) / windowHigh) * 100;

    return {
      currentPrice,
      highPrice:  windowHigh,
      highDate:   windowHighDate,
      dropPct,
    };
  }
}
