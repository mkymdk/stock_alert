/**
 * config.ts — Static configuration for the stock alert system
 *
 * Edit this file to add/remove stocks or adjust thresholds.
 * Sensitive values (SLACK_WEBHOOK_URL) are stored in GAS Script Properties,
 * not here, because this file is committed to version control.
 */

/** List of stocks to monitor */
const STOCKS: StockConfig[] = [
  { symbol: '7203', name: 'トヨタ自動車',         market: 'TSE' },
  { symbol: '6758', name: 'ソニーグループ',        market: 'TSE' },
  { symbol: '9984', name: 'ソフトバンクグループ',  market: 'TSE' },
  { symbol: '6861', name: 'キーエンス',            market: 'TSE' },
  { symbol: '4063', name: '信越化学工業',          market: 'TSE' },
  { symbol: '8306', name: '三菱UFJフィナンシャル・グループ', market: 'TSE' },
  // To add a US stock in the future:
  // { symbol: 'AAPL', name: 'Apple Inc.',  market: 'NASDAQ' },
];

/**
 * Number of calendar days to look back when finding the recent high.
 * Yahoo Finance data is fetched for 6 months (range=6mo) and then
 * filtered to this window, so values between 30 and 180 work without
 * touching the provider code.
 */
const LOOKBACK_DAYS = 90;

/**
 * Percentage drop from the recent high that triggers an alert.
 * Use a positive number — the comparison is applied as a negative threshold.
 * Example: 20 → alert when the stock is 20% or more below its recent high.
 */
const DROP_THRESHOLD_PCT = 20;
