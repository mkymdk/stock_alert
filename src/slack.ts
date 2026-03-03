/**
 * slack.ts — Slack Incoming Webhook notification
 *
 * The webhook URL is stored in GAS Script Properties (not in source code)
 * because it is a secret.
 *
 * To set it:
 *   GAS Editor → Project Settings → Script Properties
 *   Key:   SLACK_WEBHOOK_URL
 *   Value: https://hooks.slack.com/services/T.../B.../...
 */

/** Human-readable label shown in Slack messages per market */
const MARKET_LABEL: Record<Market, string> = {
  TSE:    '東証',
  NYSE:   'NYSE',
  NASDAQ: 'NASDAQ',
};

/**
 * Sends a drop alert for one stock to the configured Slack channel.
 *
 * @returns true if the message was delivered successfully, false otherwise
 */
function sendSlackAlert(stock: StockConfig, data: PriceData): boolean {
  const webhookUrl = PropertiesService.getScriptProperties()
    .getProperty('SLACK_WEBHOOK_URL');

  if (!webhookUrl) {
    Logger.log('[slack] SLACK_WEBHOOK_URL is not set in Script Properties');
    return false;
  }

  const message = buildMessage(stock, data);

  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: message }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log(`[slack] UrlFetchApp error: ${(e as Error).message}`);
    return false;
  }

  const code = response.getResponseCode();
  if (code !== 200) {
    Logger.log(`[slack] Unexpected response ${code}: ${response.getContentText()}`);
    return false;
  }

  Logger.log(`[slack] Alert sent for ${stock.symbol}`);
  return true;
}

function buildMessage(stock: StockConfig, data: PriceData): string {
  const marketLabel  = MARKET_LABEL[stock.market];
  const dropStr      = data.dropPct.toFixed(1) + '%';
  const currentStr   = formatPrice(data.currentPrice, stock.market);
  const highStr      = formatPrice(data.highPrice,    stock.market);

  return [
    ':rotating_light: *株価下落アラート*',
    `銘柄: ${stock.name} (${stock.symbol}) [${marketLabel}]`,
    `現在値: ${currentStr}`,
    `直近${LOOKBACK_DAYS}日の高値: ${highStr} (${data.highDate} 達成)`,
    `下落率: ${dropStr}`,
    `（監視条件: 高値から${DROP_THRESHOLD_PCT}%以上の下落）`,
  ].join('\n');
}

/** Formats a price with appropriate currency symbol and thousands separators */
function formatPrice(price: number, market: Market): string {
  const rounded = Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return market === 'TSE' ? `¥${rounded}` : `$${rounded}`;
}
