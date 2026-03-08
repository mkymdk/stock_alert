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
function sendSlackAlert(stock: ScreenedStock, data: PriceData): boolean {
  const webhookUrl = PropertiesService.getScriptProperties()
    .getProperty('SLACK_WEBHOOK_URL');

  if (!webhookUrl) {
    Logger.log('[slack] SLACK_WEBHOOK_URL is not set in Script Properties');
    return false;
  }

  const yutaiDetail = fetchYutaiDetail(stock.symbol);
  const message = buildMessage(stock, data, yutaiDetail);

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

function buildMessage(stock: ScreenedStock, data: PriceData, yutaiDetail: string | null): string {
  const marketLabel  = MARKET_LABEL[stock.market];
  const currentStr   = formatPrice(data.currentPrice, stock.market);
  const conditions   = `配当${DIVIDEND_YIELD_MIN_PCT}%以上 / PER${PER_MAX}倍以下 / 株主優待あり / 5年高値比-${DROP_THRESHOLD_PCT}%以上`;
  const yutaiStr     = yutaiDetail ?? '株主優待あり（詳細は企業サイトをご確認ください）';

  return [
    `:rotating_light: *株価下落アラート*（${conditions}）`,
    `銘柄: ${stock.name} (${stock.symbol}) [${marketLabel}]`,
    `現在値: ${currentStr}  |  下落率: ${data.dropPct.toFixed(1)}%`,
    `配当利回り: ${stock.dividendYieldPct.toFixed(2)}%  |  PER: ${stock.per.toFixed(1)}倍`,
    `株主優待: ${yutaiStr}`,
  ].join('\n');
}

/** Formats a price with appropriate currency symbol and thousands separators */
function formatPrice(price: number, market: Market): string {
  const rounded = Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return market === 'TSE' ? `¥${rounded}` : `$${rounded}`;
}
