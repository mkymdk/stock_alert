/**
 * yutaiProvider.ts — 株主優待銘柄のスクリーニング取得
 *
 * minkabu.jp の株主優待検索 JSON API から、配当・PER フィルタ済みの
 * ScreenedStock[] を直接返す。
 *
 * URL パラメータでサーバー側フィルタリングするため、Yahoo Finance v7 は不要。
 * キャッシュなし — 毎回最新データを取得する（週次実行のため許容範囲内）。
 */

/** minkabu 株主優待 + 配当・PER フィルタ済み銘柄検索 JSON API */
const YUTAI_SEARCH_URL = 'https://minkabu.jp/stock/search';

const YUTAI_DETAIL_MAX_LEN = 120; // Slack メッセージ内の優待内容の最大文字数

/**
 * 株主優待あり・配当 >= DIVIDEND_YIELD_MIN_PCT・PER <= PER_MAX の条件を満たす
 * 銘柄一覧を minkabu API から取得して ScreenedStock[] として返す。
 */
function fetchFilteredStocks(): ScreenedStock[] {
  const stocks: ScreenedStock[] = [];
  let totalPages = 1;

  for (let page = 1; page <= Math.min(totalPages, YUTAI_MAX_PAGES); page++) {
    const url =
      `${YUTAI_SEARCH_URL}?yutai_exist=1` +
      `&dividend_yield[0]=${DIVIDEND_YIELD_MIN_PCT}&dividend_yield[1]=max` +
      `&per[0]=min&per[1]=${PER_MAX}` +
      `&page=${page}`;

    let data: {
      items: Array<{
        financialItemCode?: string;
        financialItemName?: string;
        per?: number | null;
        dividendYield?: number | null;
      }>;
      pagination: { totalPages: number; totalCount: number };
    };

    try {
      const resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (resp.getResponseCode() !== 200) {
        Logger.log(`[yutai] HTTP ${resp.getResponseCode()} (page ${page}) — 終了`);
        break;
      }

      data = JSON.parse(resp.getContentText());
    } catch (e) {
      Logger.log(`[yutai] page ${page} error: ${(e as Error).message}`);
      break;
    }

    if (page === 1) {
      totalPages = data.pagination?.totalPages ?? 1;
      Logger.log(
        `[yutai] 対象銘柄: ${data.pagination?.totalCount ?? '?'}件` +
        ` / ${totalPages}ページ`,
      );
    }

    const items = data.items ?? [];
    for (const item of items) {
      const code = item.financialItemCode;
      if (!code) continue;

      const per              = item.per ?? null;
      const dividendYieldPct = item.dividendYield ?? null;

      // サーバー側フィルタが効いているはずだが、念のためクライアント側でも確認
      if (per === null || dividendYieldPct === null) continue;
      if (dividendYieldPct < DIVIDEND_YIELD_MIN_PCT) continue;
      if (per > PER_MAX) continue;

      stocks.push({
        symbol:          code,
        name:            item.financialItemName ?? code,
        market:          'TSE',
        per,
        dividendYieldPct,
      });
    }

    Logger.log(`[yutai] page ${page}/${totalPages}: +${items.length}件 (累計 ${stocks.length})`);
    Utilities.sleep(500);
  }

  Logger.log(`[yutai] スクリーニング完了: ${stocks.length}銘柄`);
  return stocks;
}

/**
 * 指定銘柄の株主優待内容を minkabu からスクレイピングして返す。
 * アラート送信直前に呼び出すため、対象は通知銘柄のみ（件数は少ない）。
 * 取得できない場合は null を返す（呼び出し元で「株主優待あり」等にフォールバック）。
 */
function fetchYutaiDetail(symbol: string): string | null {
  Utilities.sleep(500); // サーバー負荷軽減（複数銘柄アラート時も連続リクエストを防ぐ）

  const url = `https://minkabu.jp/stock/${symbol}/yutai`;
  let html: string;

  try {
    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (resp.getResponseCode() !== 200) return null;
    html = resp.getContentText();
  } catch (e) {
    Logger.log(`[yutai] detail error (${symbol}): ${(e as Error).message}`);
    return null;
  }

  // minkabu の優待内容は <dt>優待内容</dt><dd>...</dd> または <th>優待内容</th><td>...</td> の形式
  const patterns = [
    /<dt[^>]*>優待内容<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/,
    /<th[^>]*>優待内容<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const text = match[1]
        .replace(/<[^>]+>/g, ' ') // HTMLタグを除去
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 0) {
        return text.length > YUTAI_DETAIL_MAX_LEN
          ? text.slice(0, YUTAI_DETAIL_MAX_LEN - 1) + '…'
          : text;
      }
    }
  }

  return null;
}
