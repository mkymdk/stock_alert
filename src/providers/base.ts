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
   * Fetches price data over the 5-year range for a single stock.
   * The lookbackDays parameter is retained for interface compatibility
   * but is unused — the full 5-year range is always used.
   */
  fetchPriceData(stock: StockConfig, lookbackDays: number): PriceData | null;
}
