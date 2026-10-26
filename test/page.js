// 中継ページの動き。判定は router.js（正本）。アプリの一覧は build が config/apps.json から作る apps.js
import { plan } from './router.js';
import { APPS } from './apps.js';
import { BUILD } from './version.js';

// 最下段に版を出す。テストのページ（公開先の test/）では「テスト」と分かるようにする
// （promote は中身を変えずに写すので、本番かテストかはファイルではなく置き場所で見分ける）
const isTest = /\/test\/(index\.html)?$/.test(location.pathname);
document.getElementById('ver').textContent = `${isTest ? 'テスト ・ ' : ''}link-router ${BUILD}`;
if (isTest) document.body.classList.add('is-test');

// 同じタブのまま `#` だけ違うリンクへ移ると、ページは読み直されず前のリンクのボタンが残る（押すと前の行き先が開く）。
// `#` が変わったら読み直して、最初から判定し直す（2026-10-12。Codex Round 1。下の replaceState は hashchange を起こさない）
window.addEventListener('hashchange', () => location.reload());

const r = plan(location.hash, APPS);

// ★行き先をアドレスバーから消す（画面を見せたり共有したりしたときに、行き先URLが残らないように）
history.replaceState(null, '', location.pathname + location.search);

const msg = document.getElementById('msg');
const btn = document.getElementById('open');

if (!r.ok) {
  msg.textContent = r.reason;
} else if (r.custom) {
  // PC 用（2026-10-26）: 独自のリンク（例 company-chrome:claude）へ移る。移った後もこのページは残る（外部のアプリを開くだけなので）
  btn.href = r.href;
  btn.textContent = r.label;
  btn.hidden = false;           // 自動の遷移が止められたとき用
  location.href = r.href;
  msg.textContent = `${r.appName} で開きました（${r.target}）。このタブは閉じてかまいません。`;
  // 自動では閉じない: Firefox の「開くアプリ」の確認が出ている間にタブを閉じると、確認ごと消える（推測）。
  // また Firefox は script で開いていないタブを閉じられないことがある。押したときだけ閉じ、閉じられなければ案内を出す
  const close = document.getElementById('close');
  close.hidden = false;
  close.addEventListener('click', () => {
    window.close();
    setTimeout(() => { close.textContent = 'このタブは Ctrl+W で閉じてください'; close.disabled = true; }, 300);
  });
} else {
  msg.textContent = r.launchOnly ? `${r.appName} を起動します` : `${r.host} を ${r.appName} で開きます`;
  btn.href = r.intent;
  btn.textContent = r.label;
  btn.hidden = false;           // 開き先が決まったときだけボタンを出す
  location.href = r.intent;     // 自動で試す。Chrome に止められたら、ボタンを押す
}
