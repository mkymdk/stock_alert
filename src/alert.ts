/**
 * alert.ts — 株価下落チェック
 *
 * スクリーニング済み銘柄（配当・PER・株主優待フィルタ通過済み）に対して
 * 過去5年高値からの下落率を確認し、閾値を超えた場合に Slack へ通知する。
 *
 * 重複防止なし — 週次トリガーのため、条件を満たす限り毎週通知する。
 */

/**
 * 市場に応じた StockProvider を返す。
 * 将来的に市場ごとに異なるプロバイダーへ切り替える場合はここを更新。
 */
function getProvider(_market: Market): StockProvider {
  return new YahooFinanceProvider();
}

/**
 * スクリーニング済み銘柄の過去5年高値からの下落率を確認し、
 * DROP_THRESHOLD_PCT% 以上下落していれば Slack に通知する。
 */
function checkAndAlert(stock: ScreenedStock): void {
  Logger.log(`[alert] チェック中: ${stock.name} (${stock.symbol})`);

  const provider = getProvider(stock.market);
  const data     = provider.fetchPriceData(stock, 0);

  if (!data) {
    Logger.log(`[alert] ${stock.symbol} — データ取得失敗、スキップ`);
    return;
  }

  Logger.log(
    `[alert] ${stock.symbol}` +
    ` | 現在値=${data.currentPrice.toFixed(0)}` +
    ` | 5年高値=${data.highPrice.toFixed(0)}` +
    ` | 下落率=${data.dropPct.toFixed(2)}%`,
  );

  if (data.dropPct > -DROP_THRESHOLD_PCT) {
    Logger.log(`[alert] ${stock.symbol} — 下落率 ${data.dropPct.toFixed(1)}% が閾値未満、スキップ`);
    return;
  }

  Logger.log(`[alert] ${stock.symbol} — 閾値超過、Slack 送信`);
  sendSlackAlert(stock, data);
}
