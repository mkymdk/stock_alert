/**
 * main.ts — Orchestration and trigger management
 *
 * Functions exposed to the GAS runtime:
 *
 *   checkAllStocks()    — Main entry point, called by the weekly trigger.
 *   setupTrigger()      — Run once after first deployment to register the trigger.
 *   manualRun()         — Convenience wrapper for manual testing.
 *   refreshYutaiCache() — Manually force-refresh the 株主優待 symbol list cache.
 */

/**
 * 株主優待・配当・PER の条件を満たす銘柄を動的にスクリーニングし、
 * 過去5年高値から DROP_THRESHOLD_PCT% 以上下落した銘柄を Slack に通知する。
 * 毎週金曜 16:00 JST のトリガーから自動実行される。
 */
function checkAllStocks(): void {
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss zzz');
  Logger.log(`=== 株価アラート 実行開始: ${now} ===`);

  const stocks = getScreenedStocks();
  Logger.log(`[main] スクリーニング通過銘柄数: ${stocks.length}`);

  for (const stock of stocks) {
    try {
      checkAndAlert(stock);
    } catch (e) {
      Logger.log(`[main] ${stock.symbol} で未捕捉エラー: ${(e as Error).message}`);
    }
  }

  Logger.log('=== 株価アラート 実行完了 ===');
}

/**
 * Registers a weekly trigger that runs checkAllStocks() every Friday at 16:00 JST.
 *
 * Run this function ONCE from the GAS editor after the initial deployment:
 *   GAS Editor → select "setupTrigger" from the dropdown → click Run
 *
 * The function is idempotent — ALL existing project triggers are deleted before
 * new ones are created, so calling it multiple times is safe.
 */
function setupTrigger(): void {
  const fn = 'checkAllStocks';

  // Delete ALL project triggers to start fresh
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`[setup] Deleted trigger for ${t.getHandlerFunction()}`);
    ScriptApp.deleteTrigger(t);
  });

  // Create a new weekly trigger: every Friday at 16:00 JST
  // (appsscript.json sets timeZone=Asia/Tokyo, so atHour(16) is JST)
  ScriptApp.newTrigger(fn)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();

  Logger.log(`[setup] Weekly trigger created: ${fn} — every Friday at 16:00 JST`);
}

/**
 * Runs checkAllStocks() immediately.
 * Useful for testing after deployment without waiting for Friday.
 *
 * GAS Editor → select "manualRun" → click Run
 */
function manualRun(): void {
  Logger.log('[main] Manual run triggered');
  checkAllStocks();
}

/**
 * 株主優待リストのキャッシュを強制再取得する。
 * 通常は年1回自動更新されるが、優待新設・廃止が多い時期（3月・9月頃）などに
 * 手動で実行してキャッシュを最新化できる。
 *
 * GAS Editor → select "refreshYutaiCache" → click Run
 */
function refreshYutaiCache(): void {
  PropertiesService.getScriptProperties().deleteProperty(YUTAI_CACHE_KEY);
  Logger.log('[main] 株主優待キャッシュを削除 — 再スクレイピング開始');
  const symbols = fetchYutaiSymbols();
  Logger.log(`[main] 完了: ${symbols.length}銘柄をキャッシュしました`);
}
