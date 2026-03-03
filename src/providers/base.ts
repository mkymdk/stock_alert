/**
 * providers/base.ts — StockProvider interface
 *
 * Any data source (Yahoo Finance, Alpha Vantage, etc.) implements this
 * interface so that alert.ts remains agnostic about where the data comes from.
 * Adding a new provider only requires implementing this interface and
 * registering it in getProvider() in alert.ts.
 */

interface StockProvider {
  /** Markets this provider can serve */
  readonly supportedMarkets: ReadonlyArray<Market>;

  /**
   * Fetches normalised price data for a single stock.
   *
   * @param stock        The stock to look up
   * @param lookbackDays Number of calendar days to scan for the recent high
   * @returns            Populated PriceData, or null on any failure
   */
  fetchPriceData(stock: StockConfig, lookbackDays: number): PriceData | null;
}
