// ════════════════════════════════════
// 施設ごとの設定（浅間酒造観光センター）
// なぎの木テラス版ダッシュボードの共通コードを、この設定で浅間酒造用に切り替える。
// ════════════════════════════════════

export var FACILITY_NAME = "浅間酒造観光センター";
export var FACILITY_ICON = "🏔️";

// ブラウザ保存キーの接頭辞（なぎのき版は "nk_"）
export var KEY_PREFIX = "as_";

// GAS Webアプリ
export var GAS_URL_KEY = KEY_PREFIX + "gas_url";
export var DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbyqxwGq0-cbou7o0Ivef0pau_ETvV8kwqZ9kEfkctTA--6TsYfkqLOK53WPjio7yMfw/exec";

// 部門（POS日別CSVの取込先）
export var SUB_DEPTS = ["販売部", "外売店", "KURATTORIA150", "さくら亭", "レストラン", "ネット販売"];
export var DEPTS = ["全体"].concat(SUB_DEPTS);
export var DC = {
  "全体": "#1b4332",
  "販売部": "#c1440e",
  "外売店": "#386641",
  "KURATTORIA150": "#b5651d",
  "さくら亭": "#4a6fa5",
  "レストラン": "#7b2d8e",
  "ネット販売": "#2d6e8e"
};

// 月次サマリでの部門の合算。外売店は2026年3〜8月だけ別店舗（KURATERRACE）で計上していたため、
// 前年と比べられるよう販売部に合算する（それ以外の月は元から販売部に含まれている）
export var SUMMARY_MERGE = { "外売店": "販売部" };

// 商品別CSVの「部門名」→ 部門
export var DMAP = {
  // 販売部
  "センター売店": "販売部", "その他売店": "販売部", "自家製菓子": "販売部",
  "仕入れ菓子": "販売部", "清酒": "販売部", "焼酎": "販売部",
  "リキュール": "販売部", "その他酒類": "販売部", "酒蔵限定品": "販売部",
  "漬物・食品": "販売部", "発酵食品": "販売部", "化粧品": "販売部",
  "非食品": "販売部", "こけし類": "販売部", "浅間山麓": "販売部",
  "ぐんま想賓館扱い": "販売部", "浅まるしぇ": "販売部", "自販機": "販売部",
  "おつまみ": "販売部", "外販": "販売部",
  // 外売店（KURATERRACE）
  "外売店": "外売店", "売店（洋食扱い）": "外売店", "売店（調理扱い）": "外売店",
  // KURATTORIA150
  "PiZZA(イートイン)": "KURATTORIA150", "Pizza(テイクアウト)": "KURATTORIA150",
  "パスタ": "KURATTORIA150", "セット": "KURATTORIA150",
  "ドリンク": "KURATTORIA150", "仕出しPizza": "KURATTORIA150",
  // ひもかわ さくら亭
  "さくら亭フリー": "さくら亭", "軽食堂": "さくら亭",
  "軽食堂テイクアウト": "さくら亭", "軽食堂飲料その他": "さくら亭",
  // レストラン
  "大食堂予約": "レストラン", "大食堂飲料": "レストラン",
  "アラカルト": "レストラン", "町内弁当": "レストラン",
  // ネット販売
  "ネット　セット商品": "ネット販売", "ネット　焼酎・リキュール": "ネット販売",
  "ネット　菓子": "ネット販売", "ネット　酒類": "ネット販売"
};

// ── 期首月 ──
// 月次サマリの「期累計」と経営指標（損益計算書）の期の区切りに使う。
// ⚙️設定から変更でき、このブラウザに保存される。
export var FY_START_KEY = KEY_PREFIX + "fy_start";
export var DEFAULT_FY_START_MONTH = 4;

export function getFyStartMonth() {
  try {
    var v = parseInt(localStorage.getItem(FY_START_KEY), 10);
    if (v >= 1 && v <= 12) return v;
  } catch (e) { /* ignore */ }
  return DEFAULT_FY_START_MONTH;
}

export function setFyStartMonth(m) {
  try { localStorage.setItem(FY_START_KEY, String(m)); } catch (e) { /* ignore */ }
}

// 期の表示名。期番号が分からないので「2026年度」と表記する
export function fyLabel(startYear) {
  return startYear + "年度";
}
