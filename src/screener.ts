/**
 * screener.ts — ファンダメンタルズスクリーニング
 *
 * 株主優待銘柄リストに対して配当利回りと PER のフィルタを適用し、
 * 条件を満たす ScreenedStock の配列を返す。
 *
 * データ取得フロー:
 *   fetchYutaiSymbols()         — 株主優待銘柄コード一覧（キャッシュあり）
 *   fetchBatchFundamentals()    — Yahoo Finance v7 バッチ取得（50銘柄/リクエスト）
 *   フィルタ: 配当 >= DIVIDEND_YIELD_MIN_PCT AND PER <= PER_MAX
 *
 * 価格下落チェック（過去5年高値との比較）は alert.ts で別途行う。
 */

/**
 * スクリーニング条件（配当・PER・株主優待）を満たした銘柄リストを返す。
 * 毎回最新データを取得する（週次実行のため許容範囲内）。
 */
function getScreenedStocks(): ScreenedStock[] {
  const symbols = fetchYutaiSymbols();
  Logger.log(`[screener] 株主優待銘柄数: ${symbols.length}`);

  if (symbols.length === 0) {
    Logger.log('[screener] 株主優待リストが空 — スキップ');
    return [];
  }

  const provider     = new YahooFinanceProvider();
  const fundamentals = provider.fetchBatchFundamentals(symbols, 'TSE');
  Logger.log(`[screener] ファンダメンタルズ取得: ${fundamentals.size}銘柄`);

  const screened: ScreenedStock[] = [];

  for (const symbol of symbols) {
    const fund = fundamentals.get(symbol);
    if (!fund) continue;

    const { per, dividendYieldPct, name } = fund;

    // 取得できなかった項目がある場合は除外
    if (per === null || dividendYieldPct === null) continue;

    // 配当利回りフィルタ（2%以上）
    if (dividendYieldPct < DIVIDEND_YIELD_MIN_PCT) continue;

    // PERフィルタ（35倍以下）
    if (per > PER_MAX) continue;

    screened.push({ symbol, name, market: 'TSE', per, dividendYieldPct });
    Logger.log(
      `[screener] 通過: ${symbol} ${name}` +
      ` | 配当=${dividendYieldPct.toFixed(2)}%` +
      ` | PER=${per.toFixed(1)}倍`,
    );
  }

  Logger.log(`[screener] フィルタ後: ${screened.length}銘柄`);
  return screened;
}
