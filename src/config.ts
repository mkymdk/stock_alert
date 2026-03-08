/**
 * config.ts — スクリーニング条件の設定
 *
 * 銘柄はハードコードせず、実行時に以下の条件で動的に選択される:
 *   1. 株主優待あり（minkabu.jp 掲載）
 *   2. 配当利回り >= DIVIDEND_YIELD_MIN_PCT
 *   3. PER <= PER_MAX
 *   4. 過去5年高値から DROP_THRESHOLD_PCT% 以上下落
 *
 * 機密値（SLACK_WEBHOOK_URL）は GAS Script Properties に格納し、
 * このファイルには含めない。
 */

/** アラート閾値: 過去5年高値からこの%以上下落した場合に通知 */
const DROP_THRESHOLD_PCT = 25;

/** 最低配当利回り (%) — これを下回る銘柄は除外 */
const DIVIDEND_YIELD_MIN_PCT = 2.0;

/** PER 上限 — これを超える銘柄は除外 */
const PER_MAX = 35;

/** minkabu 株主優待 JSON API の最大取得ページ数（1ページ50件） */
const YUTAI_MAX_PAGES = 50;
