// build.mjs が config/apps.json から作る。手で直さない
export const APPS = Object.freeze({
  "firefox": {
    "name": "Firefox",
    "label": "Firefoxで開く",
    "package": "org.mozilla.firefox",
    "hosts": [
      "script.google.com"
    ]
  },
  "smartex": {
    "name": "スマートEX",
    "label": "スマートEXで開く",
    "package": "jp.co.jr_central.exreserve",
    "hosts": [
      "shinkansen2.jr-central.co.jp"
    ],
    "launch": true
  }
});
