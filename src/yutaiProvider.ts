/**
 * yutaiProvider.ts — 株主優待銘柄リストの取得
 *
 * minkabu.jp の株主優待ページをスクレイピングして
 * 東証銘柄コード（4桁）の配列を返す。
 *
 * 結果は Script Properties にキャッシュされ、YUTAI_CACHE_TTL_MS 経過後に
 * 再スクレイピングする（週次トリガー時は通常キャッシュが有効）。
 */

const YUTAI_BASE_URL = 'https://minkabu.jp/yutai';
const YUTAI_CACHE_KEY = 'YUTAI_SYMBOLS';

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
 * minkabu.jp の株主優待ページを最大 YUTAI_MAX_PAGES ページ分スクレイピングし、
 * 4桁の銘柄コードを重複なく返す。
 */
function scrapeYutaiSymbols(): string[] {
  const symbolSet = new Set<string>();

  for (let page = 1; page <= YUTAI_MAX_PAGES; page++) {
    const url = `${YUTAI_BASE_URL}?page=${page}`;
    let html: string;

    try {
      const resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (resp.getResponseCode() !== 200) {
        Logger.log(`[yutai] HTTP ${resp.getResponseCode()} (page ${page}) — 終了`);
        break;
      }

      html = resp.getContentText();
    } catch (e) {
      Logger.log(`[yutai] page ${page} fetch error: ${(e as Error).message}`);
      break;
    }

    const before = symbolSet.size;
    const regex  = /href="\/stock\/(\d{4})["\/]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      symbolSet.add(match[1]);
    }

    Logger.log(`[yutai] page ${page}: +${symbolSet.size - before}銘柄 (累計 ${symbolSet.size})`);

    // ページに新しいコードがなければ最終ページ
    if (symbolSet.size === before && page > 1) break;

    Utilities.sleep(500);
  }

  Logger.log(`[yutai] スクレイピング完了: ${symbolSet.size}銘柄`);
  return Array.from(symbolSet);
}
