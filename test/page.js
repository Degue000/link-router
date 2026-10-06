// 中継ページの動き。判定は router.js（正本）。アプリの一覧は build が config/apps.json から作る apps.js
import { plan } from './router.js';
import { APPS } from './apps.js';
import { BUILD } from './version.js';

// 最下段に版を出す。テストのページ（公開先の test/）では「テスト」と分かるようにする
// （promote は中身を変えずに写すので、本番かテストかはファイルではなく置き場所で見分ける）
const isTest = /\/test\/(index\.html)?$/.test(location.pathname);
document.getElementById('ver').textContent = `${isTest ? 'テスト ・ ' : ''}link-router ${BUILD}`;
if (isTest) document.body.classList.add('is-test');

const r = plan(location.hash, APPS);

// ★行き先をアドレスバーから消す（画面を見せたり共有したりしたときに、行き先URLが残らないように）
history.replaceState(null, '', location.pathname + location.search);

const msg = document.getElementById('msg');
const btn = document.getElementById('open');

if (!r.ok) {
  msg.textContent = r.reason;
} else {
  msg.textContent = r.launchOnly ? `${r.appName} を起動します` : `${r.host} を ${r.appName} で開きます`;
  btn.href = r.intent;
  btn.textContent = r.label;
  btn.hidden = false;           // 開き先が決まったときだけボタンを出す
  location.href = r.intent;     // 自動で試す。Chrome に止められたら、ボタンを押す
}
