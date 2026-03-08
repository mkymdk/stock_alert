/**
 * yutaiProvider.ts — 株主優待銘柄リストの取得
 *
 * minkabu.jp の株主優待ページをスクレイピングして
 * 東証銘柄コード（4桁）の配列を返す。
 *
 * 結果は Script Properties にキャッシュされ、YUTAI_CACHE_TTL_MS 経過後に
 * 再スクレイピングする（週次トリガー時は通常キャッシュが有効）。
 */

/** 株主優待銘柄一覧の JSON API（Accept: application/json ヘッダーが必要） */
const YUTAI_SEARCH_URL      = 'https://minkabu.jp/stock/search?yutai_exist=1&page=';
const YUTAI_CACHE_KEY       = 'YUTAI_SYMBOLS';
const YUTAI_DETAIL_MAX_LEN  = 120; // Slack メッセージ内の優待内容の最大文字数

/**
 * 株主優待を実施している東証銘柄コードの配列を返す。
 * キャッシュが有効な場合はキャッシュから返す。
 */
function fetchYutaiSymbols(): string[] {
  const props = PropertiesService.getScriptProperties();
  const raw   = props.getProperty(YUTAI_CACHE_KEY);

  if (raw) {
    try {
      const cached: { ts: number; codes: string } = JSON.parse(raw);
      if (Date.now() - cached.ts < YUTAI_CACHE_TTL_MS) {
        const symbols = cached.codes.split(',');
        Logger.log(`[yutai] キャッシュ使用: ${symbols.length}銘柄`);
        return symbols;
      }
    } catch (_) {
      // キャッシュが壊れていれば再スクレイピング
    }
  }

  Logger.log('[yutai] キャッシュ期限切れ — スクレイピング開始');
  const symbols = scrapeYutaiSymbols();

  if (symbols.length > 0) {
    try {
      props.setProperty(
        YUTAI_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), codes: symbols.join(',') }),
      );
      Logger.log(`[yutai] キャッシュ更新: ${symbols.length}銘柄`);
    } catch (e) {
      Logger.log(`[yutai] キャッシュ保存失敗: ${(e as Error).message}`);
    }
  }

  return symbols;
}

/**
 * minkabu の株主優待銘柄検索 JSON API から全銘柄コードを取得する。
 * 1ページ50件。初回レスポンスの pagination.totalPages まで自動的にループする。
 */
function scrapeYutaiSymbols(): string[] {
  const symbols: string[] = [];
  let totalPages = 1;

  for (let page = 1; page <= Math.min(totalPages, YUTAI_MAX_PAGES); page++) {
    const url = `${YUTAI_SEARCH_URL}${page}`;

    let data: { items: Array<{ financialItemCode?: string }>; pagination: { totalPages: number } };
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

    // 初回レスポンスで総ページ数を確定
    if (page === 1) {
      totalPages = data.pagination?.totalPages ?? 1;
      Logger.log(`[yutai] 総ページ数: ${totalPages} (推定 ${totalPages * 50} 銘柄)`);
    }

    const items = data.items ?? [];
    for (const item of items) {
      if (item.financialItemCode) symbols.push(item.financialItemCode);
    }

    Logger.log(`[yutai] page ${page}/${totalPages}: +${items.length}銘柄 (累計 ${symbols.length})`);
    Utilities.sleep(500);
  }

  Logger.log(`[yutai] 取得完了: ${symbols.length}銘柄`);
  return symbols;
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
