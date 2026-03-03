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
