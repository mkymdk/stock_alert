/**
 * alert.ts — Drop detection logic
 *
 * For each stock, this module:
 *   1. Selects the appropriate data provider based on the stock's market
 *   2. Fetches normalised price data
 *   3. Fires a Slack alert if the drop condition is met
 *
 * No deduplication state is maintained — the trigger runs once a week
 * (every Friday), so the weekly cadence itself prevents notification spam.
 * If a stock remains below the threshold the following Friday, a fresh
 * alert is intentionally sent again.
 */

/**
 * Returns the appropriate StockProvider for the given market.
 * Add new providers here as additional markets are supported.
 */
function getProvider(_market: Market): StockProvider {
  // Currently YahooFinanceProvider handles all supported markets.
  // Future example:
  //   if (market === 'LSE') return new AlphaVantageProvider();
  return new YahooFinanceProvider();
}

/**
 * Checks a single stock and sends a Slack alert if the drop condition is met.
 *
 * @param stock  Stock descriptor from STOCKS in config.ts
 */
function checkAndAlert(stock: StockConfig): void {
  Logger.log(`[alert] Checking ${stock.name} (${stock.symbol})`);

  const provider = getProvider(stock.market);
  const data     = provider.fetchPriceData(stock, LOOKBACK_DAYS);

  if (!data) {
    Logger.log(`[alert] Skipping ${stock.symbol} — data fetch failed`);
    return;
  }

  Logger.log(
    `[alert] ${stock.symbol} | current=${data.currentPrice.toFixed(0)}` +
    ` | high=${data.highPrice.toFixed(0)} | drop=${data.dropPct.toFixed(2)}%`,
  );

  if (data.dropPct > -DROP_THRESHOLD_PCT) {
    Logger.log(`[alert] ${stock.symbol} — drop below threshold (${data.dropPct.toFixed(1)}%), no alert`);
    return;
  }

  Logger.log(`[alert] ${stock.symbol} — threshold exceeded, sending alert`);
  sendSlackAlert(stock, data);
}
