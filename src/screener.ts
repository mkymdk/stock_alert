/**
 * screener.ts — ファンダメンタルズスクリーニング
 *
 * minkabu API のサーバー側フィルタ（株主優待あり・配当 >= DIVIDEND_YIELD_MIN_PCT・
 * PER <= PER_MAX）を通過した銘柄を ScreenedStock[] として返す。
 *
 * 価格下落チェック（過去5年高値との比較）は alert.ts で別途行う。
 */

/**
 * スクリーニング条件（配当・PER・株主優待）を満たした銘柄リストを返す。
 */
function getScreenedStocks(): ScreenedStock[] {
  return fetchFilteredStocks();
}
