/**
 * main.ts — Orchestration and trigger management
 *
 * Functions exposed to the GAS runtime:
 *
 *   checkAllStocks()  — Main entry point, called by the weekly trigger.
 *   setupTrigger()    — Run once after first deployment to register the trigger.
 *   manualRun()       — Convenience wrapper for manual testing.
 */

/**
 * Checks every configured stock and sends Slack alerts where warranted.
 * Called automatically by the weekly time-based trigger (every Friday 16:00 JST).
 */
function checkAllStocks(): void {
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss zzz');
  Logger.log(`=== Stock alert run started: ${now} ===`);

  for (const stock of STOCKS) {
    try {
      checkAndAlert(stock);
    } catch (e) {
      // Isolate errors per stock so one bad ticker doesn't abort the entire run
      Logger.log(`[main] Uncaught error for ${stock.symbol}: ${(e as Error).message}`);
    }
  }

  Logger.log('=== Stock alert run finished ===');
}

/**
 * Registers a weekly trigger that runs checkAllStocks() every Friday at 16:00 JST.
 *
 * Run this function ONCE from the GAS editor after the initial deployment:
 *   GAS Editor → select "setupTrigger" from the dropdown → click Run
 *
 * The function is idempotent — any existing trigger for checkAllStocks is
 * removed before the new one is created, so calling it multiple times is safe.
 */
function setupTrigger(): void {
  const fn = 'checkAllStocks';

  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === fn)
    .forEach(t => {
      ScriptApp.deleteTrigger(t);
      Logger.log(`[setup] Deleted existing trigger for ${fn}`);
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
