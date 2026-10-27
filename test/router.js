/**
 * 中継ページの判定。**ページ（page.js）とリンク作成（scripts/make-link.mjs）の両方がこれを使う**
 * （規則を2か所に書くと食い違うので、正本はここ1つ）。ブラウザにも Node にも依存しない純粋な関数。
 *
 * リンクの形: <公開先のURL>?openExternalBrowser=1#a=<アプリのキー>&u=<行き先URL（エンコード済み）>
 *   （ここに URL の例を書かない。公開物に http(s):// を置かない検査に当たる）
 *   - `#` より後ろ（a と u）は**サーバーへ送られない**。公開ページにも行き先URLは置かない
 *   - 行き先は **apps.json に登録したアプリ × そのアプリに許したドメイン** の組み合わせだけ開く
 *     （他人が同じ形のリンクを作っても、登録外のサイトは開かない）
 *   - `u` を省くと「アプリを起動するだけ」。**apps.json で `"launch": true` にしたアプリだけ**（2026-10-06 追加。
 *     スマートEX のアプリが、どのページのリンクも受け取らなかったため。開けるかは実機で確かめる）
 */

// 英数字・/ _ - . と、`%` に16進数2桁が続く形（例 スマホ版 Gmail の `#cv/priority/%5Ei/<ID>`。2026-10-13 追加）。
// ただし `#`（%23）と `;`（%3B）を符号化した形は通さない（intent の書式を壊す文字。念のため）
const SAFE_HASH = /^#(?:[A-Za-z0-9/_.-]|%[0-9A-Fa-f]{2}){1,200}$/;
const UNSAFE_ESCAPE = /%(?:23|3b)/i;

/**
 * PC 用の中継（2026-10-26 追加。personal-portal の REVIEW_BRIEFING §18・この README「PC 用の中継」）。
 * リンクの形: <公開先のURL>#company-chrome:<名前>（`?openExternalBrowser=1` は付けない。LINE を通らない）
 *   - PC の独自のリンク `company-chrome:<名前>`（PC の HKCU に登録した受け口が会社のプロファイルの Chrome を起動する）へ移るだけ
 *   - GAS の画面（sandbox の iframe）の中から独自のリンクへ移ると Firefox が止めた（2026-10-26 実機）。
 *     sandbox の外のふつうのページであるこの中継から移れば、Firefox が「開くアプリ」を聞いて受け口が動く見込み（推測）
 *   - **名前の許可リストをここにも置く**（受け口の許可リストと同じ名前）。URL は置かない（行き先は受け口が決める）
 *   - 形は `#<形式>:<名前>` だけ。知らない形式・知らない名前・余計な文字があれば何もしない
 */
const CUSTOM_LINKS = Object.freeze({
  'company-chrome': Object.freeze({
    appName: '会社の Chrome',
    label: '会社の Chrome で開く',
    names: Object.freeze({ claude: 'Claude', codex: 'Codex', 'bizmates-sami': 'Bizmates Sami' }),
  }),
});
const CUSTOM_HASH = /^#([a-z][a-z0-9-]{0,30}):([a-z][a-z0-9-]{0,30})$/;

/** @returns {{ok:true, appName:string, label:string, host:string, intent:string} | {ok:false, reason:string}} */
export function plan(hash, apps) {
  const fail = (reason) => ({ ok: false, reason });
  const h = String(hash || '');
  // PC 用（`#a=` の形ではないもの）。`=` `&` より前に `:` がある `#` は Android の形（a= と u=）には無いので、ここで見分ける
  if (/^#[^=&]*:/.test(h)) {
    const m = CUSTOM_HASH.exec(h);
    const kind = m && Object.prototype.hasOwnProperty.call(CUSTOM_LINKS, m[1]) ? CUSTOM_LINKS[m[1]] : null;
    const name = kind && Object.prototype.hasOwnProperty.call(kind.names, m[2]) ? m[2] : null;
    if (!name) return fail('このリンクの開き先は登録されていません');
    return { ok: true, custom: true, appName: kind.appName, label: kind.label, target: kind.names[name],
      href: `${m[1]}:${name}` };
  }
  const p = new URLSearchParams(h.replace(/^#/, ''));
  const key = p.get('a');
  const raw = p.get('u');

  const app = key && Object.prototype.hasOwnProperty.call(apps, key) ? apps[key] : null;
  if (!app || app.enabled === false) return fail('このリンクの開き先（アプリ）は登録されていません');
  if (!raw) {
    if (app.launch !== true) return fail('開くページが指定されていません');
    // 起動するだけ。ページを渡さず、package でアプリを名指しする（Chrome が許す入口がアプリに無ければ Play ストアになる）
    return { ok: true, appName: app.name, label: app.label, host: null, launchOnly: true,
      intent: `intent://#Intent;package=${app.package};end` };
  }

  let url;
  try { url = new URL(raw); } catch { return fail('開くページのURLの形が正しくありません'); }
  if (url.protocol !== 'https:') return fail('https のページだけ開けます');
  if (url.username || url.password) return fail('ログイン情報を含むURLは開けません');
  // 行き先の # 以降（例 Gmail の #inbox/<ID>）は、英数字と / _ - . だけなら通す（2026-10-06）。
  // ; や # が入ると intent の書式（#Intent;...;end）を壊したり、別のアプリの指定を紛れ込ませたりできるので断る
  if (url.hash && (!SAFE_HASH.test(url.hash) || UNSAFE_ESCAPE.test(url.hash))) return fail('この形の # を含むURLは開けません');
  if (!Array.isArray(app.hosts) || !app.hosts.includes(url.hostname)) {
    return fail(`このサイトは「${app.name}」で開くサイトとして登録されていません`);
  }

  // Chrome の intent 形式。package を名指しすると、そのアプリで開く（入っていなければ Play ストア）
  const intent = `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=${app.package};end`;
  return { ok: true, appName: app.name, label: app.label, host: url.hostname, intent };
}

/** リンクの `#` 以降を作る（make-link 用）。url を省くと「起動するだけ」。作ったものは必ず plan() で確かめてから使う */
export function fragmentFor(appKey, url) {
  const a = `#a=${encodeURIComponent(appKey)}`;
  return url == null ? a : `${a}&u=${encodeURIComponent(url)}`;
}

/** PC 用の中継の `#` 以降（試験用）。作ったものは plan() で確かめてから使う */
export function customFragment(kind, name) {
  return `#${kind}:${name}`;
}
