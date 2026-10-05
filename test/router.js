/**
 * 中継ページの判定。**ページ（page.js）とリンク作成（scripts/make-link.mjs）の両方がこれを使う**
 * （規則を2か所に書くと食い違うので、正本はここ1つ）。ブラウザにも Node にも依存しない純粋な関数。
 *
 * リンクの形: <公開先のURL>?openExternalBrowser=1#a=<アプリのキー>&u=<行き先URL（エンコード済み）>
 *   （ここに URL の例を書かない。公開物に http(s):// を置かない検査に当たる）
 *   - `#` より後ろ（a と u）は**サーバーへ送られない**。公開ページにも行き先URLは置かない
 *   - 行き先は **apps.json に登録したアプリ × そのアプリに許したドメイン** の組み合わせだけ開く
 *     （他人が同じ形のリンクを作っても、登録外のサイトは開かない）
 */

/** @returns {{ok:true, appName:string, label:string, host:string, intent:string} | {ok:false, reason:string}} */
export function plan(hash, apps) {
  const fail = (reason) => ({ ok: false, reason });
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const key = p.get('a');
  const raw = p.get('u');

  const app = key && Object.prototype.hasOwnProperty.call(apps, key) ? apps[key] : null;
  if (!app || app.enabled === false) return fail('このリンクの開き先（アプリ）は登録されていません');
  if (!raw) return fail('開くページが指定されていません');

  let url;
  try { url = new URL(raw); } catch { return fail('開くページのURLの形が正しくありません'); }
  if (url.protocol !== 'https:') return fail('https のページだけ開けます');
  if (url.username || url.password) return fail('ログイン情報を含むURLは開けません');
  if (url.hash) return fail('# を含むURLは開けません');
  if (!Array.isArray(app.hosts) || !app.hosts.includes(url.hostname)) {
    return fail(`このサイトは「${app.name}」で開くサイトとして登録されていません`);
  }

  // Chrome の intent 形式。package を名指しすると、そのアプリで開く（入っていなければ Play ストア）
  const intent = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${app.package};end`;
  return { ok: true, appName: app.name, label: app.label, host: url.hostname, intent };
}

/** リンクの `#` 以降を作る（make-link 用）。作ったものは必ず plan() で確かめてから使う */
export function fragmentFor(appKey, url) {
  return `#a=${encodeURIComponent(appKey)}&u=${encodeURIComponent(url)}`;
}
