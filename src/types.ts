/**
 * types.ts — Shared type definitions
 *
 * Centralising types here allows providers and alert logic to be
 * extended independently without circular dependencies.
 */

/** Supported stock market identifiers */
type Market = 'TSE' | 'NYSE' | 'NASDAQ'; // Extend here for future markets (e.g. 'LSE' | 'HKEX')

/** Configuration for a single monitored stock */
interface StockConfig {
  /** Ticker symbol as used by the data provider (e.g. "7203", "AAPL") */
  symbol: string;
  /** Human-readable display name used in Slack messages */
  name: string;
  /** Market the stock is listed on */
  market: Market;
}

/** Stock that has passed all fundamental screening filters (配当・PER・株主優待) */
interface ScreenedStock extends StockConfig {
  /** Trailing annual dividend yield (%) e.g. 2.5 */
  dividendYieldPct: number;
  /** Trailing P/E ratio e.g. 12.5 */
  per: number;
}

/** Fundamental metrics from the Yahoo Finance v7 batch quote API */
interface FundamentalData {
  /** Company name (longName or shortName) */
  name: string;
  /** Trailing P/E ratio, or null if unavailable */
  per: number | null;
  /** Trailing annual dividend yield (%), or null if unavailable */
  dividendYieldPct: number | null;
}

/** Normalised price data returned by any StockProvider */
interface PriceData {
  /** Most recent closing price */
  currentPrice: number;
  /** Highest intraday price within the lookback window */
  highPrice: number;
  /** Date the highPrice was achieved, formatted "YYYY-MM-DD" */
  highDate: string;
  /** Percentage change from highPrice to currentPrice — always ≤ 0 on a drop (e.g. -21.8) */
  dropPct: number;
}
