/**
 * 浅間酒造ダッシュボード v2（なぎの木テラス仕様）用の GAS 追加コード
 *
 * 追加される API
 *   GET  ?action=getPlData             … 経営指標タブ：保存済みの損益計算書データを返す
 *   POST {action:"savePlData", pl}     … 経営指標タブ：損益計算書データを保存
 *   POST {action:"getAnalysisReport"}  … AI分析レポート（日別／商品別／経営指標）
 *
 * 組み込み手順
 *   1. 浅間酒造ダッシュボードのスプレッドシート →「拡張機能」→「Apps Script」を開く
 *   2. 「＋」→「スクリプト」で新しいファイルを作り、このファイルの中身を貼り付ける
 *   3. 既存の doGet / doPost の先頭に、それぞれ次の1行を足す
 *        function doGet(e)  { var v2 = v2HandleGet_(e);  if (v2) return v2;  …既存の処理… }
 *        function doPost(e) { var v2 = v2HandlePost_(e); if (v2) return v2;  …既存の処理… }
 *   4. 「プロジェクトの設定」→「スクリプト プロパティ」に追加
 *        ANTHROPIC_API_KEY = sk-ant-...（AI分析を使う場合のみ）
 *        AI_MODEL          = claude-sonnet-5-5（省略可）
 *   5. 「デプロイ」→「デプロイを管理」→ 既存のデプロイを編集 →「新しいバージョン」で更新
 *      （URLを変えないため、新規デプロイではなく既存デプロイの更新にする）
 *
 * データの置き場所（同じスプレッドシートに自動で作られる）
 *   シート「PLデータ」        … 損益計算書データ（JSONを分割して保存）
 *   シート「AI分析キャッシュ」 … 生成済みレポート。同じデータなら2回目以降は再生成しない
 */

var V2_PL_SHEET = 'PLデータ';
var V2_CACHE_SHEET = 'AI分析キャッシュ';
var V2_CHUNK = 45000;   // 1セル50,000文字の上限に余裕を持たせる

function v2HandleGet_(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'getPlData') return v2Json_(v2GetPlData_());
  return null;
}

function v2HandlePost_(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return null; }
  if (!body || !body.action) return null;
  try {
    if (body.action === 'savePlData') return v2Json_(v2SavePlData_(body.pl));
    if (body.action === 'getAnalysisReport') return v2Json_(v2GetAnalysisReport_(body));
  } catch (err) {
    return v2Json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
  return null;
}

function v2Json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function v2Sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ── 損益計算書データ ──────────────────────────────
function v2SavePlData_(pl) {
  if (!pl || !pl.periods) return { ok: false, error: '損益計算書データがありません' };
  var json = JSON.stringify(pl);
  var rows = [];
  for (var i = 0; i < json.length; i += V2_CHUNK) rows.push([json.slice(i, i + V2_CHUNK)]);
  var sh = v2Sheet_(V2_PL_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  return { ok: true, chunks: rows.length };
}

function v2GetPlData_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(V2_PL_SHEET);
  if (!sh || sh.getLastRow() === 0) return { ok: true, pl: null };
  var vals = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  var json = vals.map(function (r) { return r[0]; }).join('');
  try { return { ok: true, pl: JSON.parse(json) }; }
  catch (err) { return { ok: false, error: '保存データの読み込みに失敗しました' }; }
}

// ── AI分析レポート ────────────────────────────────
// body: { type: 'daily'|'product'|'pl', dept, month, force, kpi }
// kpi はダッシュボード側で集計して送る（GAS側では再集計しない）
function v2GetAnalysisReport_(body) {
  var type = body.type, dept = body.dept || '全体', month = body.month || '';
  if (!body.kpi) return { ok: false, error: '分析用データが送られていません。ダッシュボードを再読み込みしてください。' };

  var dataJson = JSON.stringify(body.kpi);
  var hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataJson, Utilities.Charset.UTF_8)
  );
  var key = [type, dept, month, hash].join('|');

  var sh = v2Sheet_(V2_CACHE_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(['key', '生成日時', 'レポート(JSON)']);
  if (!body.force && sh.getLastRow() > 1) {
    var found = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(key).matchEntireCell(true).findNext();
    if (found) {
      var row = sh.getRange(found.getRow(), 1, 1, 3).getValues()[0];
      try { return { ok: true, cached: true, generatedAt: row[1], report: JSON.parse(row[2]) }; } catch (err) { /* 壊れていたら再生成 */ }
    }
  }

  var report = v2CallClaude_(type, dept, month, dataJson);
  var at = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sh.appendRow([key, at, JSON.stringify(report)]);
  return { ok: true, cached: false, generatedAt: at, report: report };
}

function v2CallClaude_(type, dept, month, dataJson) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('AI分析のAPIキーが未設定です（スクリプトプロパティ ANTHROPIC_API_KEY）');
  var model = props.getProperty('AI_MODEL') || 'claude-sonnet-5-5';

  var focus = {
    daily: '日別のPOS売上（売上・客数・客単価、平日／土日、部門別）',
    product: '商品別のPOS売上（分類別・売上上位商品・新商品・消えた商品・粗利率）',
    pl: '損益計算書（売上・原価率・販管費・人件費・営業利益・EBITDA・損益分岐点）'
  }[type] || '売上データ';

  var system =
    'あなたは観光施設（酒蔵併設の観光センター：売店・飲食・ネット販売）の経営コンサルタントです。' +
    '渡されたデータだけを根拠に、前年との比較を中心に分析してください。データにない数字を作らないこと。' +
    '金額は万円単位で丸めてよい。出力は次のJSONだけにしてください（前後に文章を付けない）。\n' +
    '{"summary":"3文以内の要約","yoy":"前年比の要点を2〜3文","facts":["データが示す事実（数字入り）を3〜6個"],' +
    '"hypotheses":["変動の要因の仮説を2〜4個"],"tasks":["来月以降に打つ具体的なタスク案を3〜5個"]}';
  var user = '施設：浅間酒造観光センター\n対象：' + focus + '\n部門：' + dept + '\n対象月：' + month +
    '\n\nデータ(JSON)：\n' + dataJson;

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model, max_tokens: 2000, system: system,
      messages: [{ role: 'user', content: user }]
    }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var out = JSON.parse(res.getContentText());
  if (code !== 200) throw new Error('AI APIエラー（' + code + '）：' + (out.error && out.error.message || ''));
  var text = (out.content || []).map(function (c) { return c.text || ''; }).join('');
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AIの応答を読み取れませんでした');
  return JSON.parse(m[0]);
}
