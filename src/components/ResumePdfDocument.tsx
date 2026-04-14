"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Noto Sans JP を Google Fonts CDN から登録
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75s.ttf",
      fontWeight: 700,
    },
  ],
});

// ── 型定義 ──────────────────────────────────────────────

interface HistoryEntry {
  year: string;
  month: string;
  content: string;
}

interface ParsedResume {
  name: string;
  nameKana: string;
  birthDate: string;
  age: string;
  gender: string;
  address: string;
  addressKana: string;
  phone: string;
  email: string;
  education: HistoryEntry[];
  workHistory: HistoryEntry[];
  qualifications: HistoryEntry[];
  motivation: string;
  selfPr: string;
  requests: string;
}

// ── Markdownパーサー ────────────────────────────────────

/**
 * AIが生成したMarkdownテキストからJIS履歴書の各セクションを抽出する。
 *
 * 想定Markdownフォーマット:
 * ## 基本情報
 * - 氏名: 山田太郎
 * - フリガナ: ヤマダタロウ
 * - 生年月日: 1990年1月1日
 * - 年齢: 36歳
 * - 性別: 男
 * - 住所: 東京都渋谷区...
 * - 住所フリガナ: トウキョウトシブヤク...
 * - 電話番号: 090-xxxx-xxxx
 * - メールアドレス: xxx@example.com
 *
 * ## 学歴
 * - 2008年 3月 東京都立○○高等学校 卒業
 * - 2012年 3月 ○○大学 工学部 卒業
 *
 * ## 職歴
 * - 2012年 4月 株式会社○○ 入社
 *
 * ## 資格・免許
 * - 2015年 6月 基本情報技術者試験 合格
 *
 * ## 志望動機
 * テキスト...
 *
 * ## 自己PR
 * テキスト...
 *
 * ## 本人希望欄
 * テキスト...
 */
function parseResumeMarkdown(markdown: string): ParsedResume {
  const result: ParsedResume = {
    name: "",
    nameKana: "",
    birthDate: "",
    age: "",
    gender: "",
    address: "",
    addressKana: "",
    phone: "",
    email: "",
    education: [],
    workHistory: [],
    qualifications: [],
    motivation: "",
    selfPr: "",
    requests: "",
  };

  // セクション分割
  const sections = splitSections(markdown);

  // 基本情報パース
  const basicInfo = sections["基本情報"] ?? "";
  result.name = extractField(basicInfo, ["氏名", "名前"]);
  result.nameKana = extractField(basicInfo, ["フリガナ", "ふりがな", "カナ"]);
  result.birthDate = extractField(basicInfo, ["生年月日"]);
  result.age = extractField(basicInfo, ["年齢"]);
  result.gender = extractField(basicInfo, ["性別"]);
  result.address = extractField(basicInfo, ["住所", "現住所"]);
  result.addressKana = extractField(basicInfo, [
    "住所フリガナ",
    "住所ふりがな",
    "住所カナ",
  ]);
  result.phone = extractField(basicInfo, ["電話番号", "電話", "TEL", "tel"]);
  result.email = extractField(basicInfo, [
    "メールアドレス",
    "メール",
    "Email",
    "email",
    "E-mail",
  ]);

  // 学歴パース
  result.education = parseHistoryEntries(sections["学歴"] ?? "");

  // 職歴パース
  result.workHistory = parseHistoryEntries(sections["職歴"] ?? "");

  // 資格パース
  const qualKey =
    Object.keys(sections).find(
      (k) => k.includes("資格") || k.includes("免許")
    ) ?? "";
  result.qualifications = parseHistoryEntries(sections[qualKey] ?? "");

  // テキストセクション
  result.motivation = extractTextSection(sections, [
    "志望動機",
    "志望理由",
    "応募動機",
  ]);
  result.selfPr = extractTextSection(sections, [
    "自己PR",
    "自己ＰＲ",
    "自己アピール",
  ]);
  result.requests = extractTextSection(sections, [
    "本人希望欄",
    "本人希望",
    "希望欄",
    "希望条件",
  ]);

  return result;
}

/**
 * Markdownを ## 見出しで分割してセクション名 -> 本文のマップを返す。
 */
function splitSections(markdown: string): Record<string, string> {
  const result: Record<string, string> = {};
  const sectionRegex = /^##\s+(.+)$/gm;
  let lastKey = "";
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(markdown)) !== null) {
    if (lastKey) {
      result[lastKey] = markdown.slice(lastIndex, match.index).trim();
    }
    lastKey = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastKey) {
    result[lastKey] = markdown.slice(lastIndex).trim();
  }

  return result;
}

/**
 * テキストブロックから「- キー: 値」形式のフィールドを抽出する。
 */
function extractField(text: string, keys: string[]): string {
  for (const key of keys) {
    const regex = new RegExp(
      `[-*]\\s*${key}\\s*[:：]\\s*(.+)`,
      "m"
    );
    const m = regex.exec(text);
    if (m) return m[1].trim();
  }
  return "";
}

/**
 * 年月付きの履歴エントリをパースする。
 * 対応フォーマット:
 * - 2012年 4月 内容
 * - 2012/04 内容
 */
function parseHistoryEntries(text: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.replace(/^\s*[-*]\s*/, "").trim();
    if (!trimmed) continue;

    // パターン1: 2012年 4月 内容
    const m1 = /^(\d{4})年\s*(\d{1,2})月\s+(.+)/.exec(trimmed);
    if (m1) {
      entries.push({ year: m1[1], month: m1[2], content: m1[3].trim() });
      continue;
    }

    // パターン2: 2012/04 内容
    const m2 = /^(\d{4})[/\-.](\d{1,2})\s+(.+)/.exec(trimmed);
    if (m2) {
      entries.push({ year: m2[1], month: m2[2], content: m2[3].trim() });
      continue;
    }

    // パターン3: 年月なしの行（前のエントリの続きなど）— そのまま追加
    if (trimmed.length > 0 && entries.length === 0) {
      entries.push({ year: "", month: "", content: trimmed });
    }
  }

  return entries;
}

/**
 * 複数の候補キーからテキストセクションを探す。
 */
function extractTextSection(
  sections: Record<string, string>,
  keys: string[]
): string {
  for (const key of keys) {
    const found = Object.keys(sections).find((k) => k.includes(key));
    if (found) {
      // リスト記号を除去してプレーンテキストにする
      return sections[found]
        .split("\n")
        .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
        .filter(Boolean)
        .join("\n");
    }
  }
  return "";
}

// ── スタイル定義 ─────────────────────────────────────────

const BORDER_COLOR = "#000000";
const BORDER_WIDTH = 1;
const THIN_BORDER = 0.5;

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 25,
    color: "#000000",
  },
  // ヘッダー
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 8,
  },
  headerDate: {
    fontSize: 8,
    textAlign: "right",
    marginBottom: 10,
  },
  // テーブル共通
  tableContainer: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: THIN_BORDER,
    borderBottomColor: BORDER_COLOR,
  },
  rowLast: {
    flexDirection: "row",
  },
  labelCell: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: THIN_BORDER,
    borderRightColor: BORDER_COLOR,
    justifyContent: "center",
  },
  valueCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: "center",
    flex: 1,
  },
  labelText: {
    fontSize: 8,
    fontWeight: 700,
  },
  valueText: {
    fontSize: 9,
  },
  kanaText: {
    fontSize: 7,
    color: "#444444",
  },
  // 写真欄
  photoBox: {
    width: 90,
    height: 120,
    borderWidth: THIN_BORDER,
    borderColor: BORDER_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  photoText: {
    fontSize: 7,
    color: "#999999",
  },
  // 学歴・職歴テーブル
  historyTable: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    marginTop: 8,
  },
  historyHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: THIN_BORDER,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: "#f5f5f5",
  },
  historyRow: {
    flexDirection: "row",
    borderBottomWidth: THIN_BORDER,
    borderBottomColor: BORDER_COLOR,
    minHeight: 18,
  },
  historyRowLast: {
    flexDirection: "row",
    minHeight: 18,
  },
  historyYearCell: {
    width: 45,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRightWidth: THIN_BORDER,
    borderRightColor: BORDER_COLOR,
    textAlign: "center",
    justifyContent: "center",
  },
  historyMonthCell: {
    width: 30,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRightWidth: THIN_BORDER,
    borderRightColor: BORDER_COLOR,
    textAlign: "center",
    justifyContent: "center",
  },
  historyContentCell: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  historyCellText: {
    fontSize: 9,
  },
  historyHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
  },
  historySectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
  },
  // テキストボックスセクション
  textBoxContainer: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    marginTop: 8,
  },
  textBoxHeader: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: THIN_BORDER,
    borderBottomColor: BORDER_COLOR,
  },
  textBoxHeaderText: {
    fontSize: 9,
    fontWeight: 700,
  },
  textBoxBody: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 50,
  },
  textBoxText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  // 資格テーブル
  qualTable: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    marginTop: 8,
  },
});

// ── サブコンポーネント ───────────────────────────────────

/**
 * 基本情報行（ラベル + 値）
 */
function InfoRow({
  label,
  value,
  labelWidth,
  isLast = false,
  kana,
}: {
  label: string;
  value: string;
  labelWidth: number;
  isLast?: boolean;
  kana?: string;
}) {
  return (
    <View style={isLast ? styles.rowLast : styles.row}>
      <View style={[styles.labelCell, { width: labelWidth }]}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>
        {kana ? <Text style={styles.kanaText}>{kana}</Text> : null}
        <Text style={styles.valueText}>{value || ""}</Text>
      </View>
    </View>
  );
}

/**
 * 学歴・職歴の履歴行
 */
function HistoryRow({
  entry,
  isLast = false,
}: {
  entry: HistoryEntry;
  isLast?: boolean;
}) {
  return (
    <View style={isLast ? styles.historyRowLast : styles.historyRow}>
      <View style={styles.historyYearCell}>
        <Text style={styles.historyCellText}>{entry.year}</Text>
      </View>
      <View style={styles.historyMonthCell}>
        <Text style={styles.historyCellText}>{entry.month}</Text>
      </View>
      <View style={styles.historyContentCell}>
        <Text style={styles.historyCellText}>{entry.content}</Text>
      </View>
    </View>
  );
}

/**
 * セクション見出し行（「学歴」「職歴」など中央表示）
 */
function SectionLabelRow({ label }: { label: string }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyYearCell}>
        <Text style={styles.historyCellText}>{""}</Text>
      </View>
      <View style={styles.historyMonthCell}>
        <Text style={styles.historyCellText}>{""}</Text>
      </View>
      <View style={styles.historyContentCell}>
        <Text style={styles.historySectionLabel}>{label}</Text>
      </View>
    </View>
  );
}

/**
 * 空行（履歴テーブルの余白行）
 */
function EmptyHistoryRow({ isLast = false }: { isLast?: boolean }) {
  return (
    <View style={isLast ? styles.historyRowLast : styles.historyRow}>
      <View style={styles.historyYearCell}>
        <Text style={styles.historyCellText}>{""}</Text>
      </View>
      <View style={styles.historyMonthCell}>
        <Text style={styles.historyCellText}>{""}</Text>
      </View>
      <View style={styles.historyContentCell}>
        <Text style={styles.historyCellText}>{""}</Text>
      </View>
    </View>
  );
}

// ── メインコンポーネント ─────────────────────────────────

interface ResumePdfDocumentProps {
  content: string;
  date: string;
}

const ResumePdfDocument: React.FC<ResumePdfDocumentProps> = ({
  content,
  date,
}) => {
  const data = parseResumeMarkdown(content);

  // 和暦変換（令和）
  const wareki = toWareki(date);

  // 学歴・職歴の合計行数を計算（最低でも余白行を追加して見栄えを整える）
  const MIN_HISTORY_ROWS = 16;
  const totalEntries =
    1 + data.education.length + 1 + 1 + data.workHistory.length + 1; // 学歴ラベル + entries + 職歴ラベル + entries + 「以上」行 x2
  const emptyRows = Math.max(0, MIN_HISTORY_ROWS - totalEntries);

  // 資格の最低行数
  const MIN_QUAL_ROWS = 6;
  const qualEmptyRows = Math.max(0, MIN_QUAL_ROWS - data.qualifications.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── ヘッダー ── */}
        <Text style={styles.headerTitle}>履 歴 書</Text>
        <Text style={styles.headerDate}>{wareki}現在</Text>

        {/* ── 基本情報 + 写真 ── */}
        <View style={{ flexDirection: "row" }}>
          {/* 左: 基本情報テーブル */}
          <View style={[styles.tableContainer, { flex: 1, marginRight: 8 }]}>
            <InfoRow
              label="フリガナ"
              value={data.nameKana}
              labelWidth={70}
            />
            <InfoRow label="氏名" value={data.name} labelWidth={70} />
            <InfoRow
              label="生年月日"
              value={
                data.birthDate
                  ? `${data.birthDate}${data.age ? `（${data.age}）` : ""}`
                  : ""
              }
              labelWidth={70}
            />
            <InfoRow label="性別" value={data.gender} labelWidth={70} />
            <InfoRow
              label="フリガナ"
              value={data.addressKana}
              labelWidth={70}
            />
            <InfoRow label="現住所" value={data.address} labelWidth={70} />
            <InfoRow label="電話番号" value={data.phone} labelWidth={70} />
            <InfoRow
              label="メール"
              value={data.email}
              labelWidth={70}
              isLast
            />
          </View>

          {/* 右: 写真欄 */}
          <View style={styles.photoBox}>
            <Text style={styles.photoText}>写真貼付</Text>
            <Text style={styles.photoText}>(縦40mm</Text>
            <Text style={styles.photoText}>x横30mm)</Text>
          </View>
        </View>

        {/* ── 学歴・職歴 ── */}
        <View style={styles.historyTable}>
          {/* ヘッダー行 */}
          <View style={styles.historyHeaderRow}>
            <View style={styles.historyYearCell}>
              <Text style={styles.historyHeaderText}>年</Text>
            </View>
            <View style={styles.historyMonthCell}>
              <Text style={styles.historyHeaderText}>月</Text>
            </View>
            <View style={styles.historyContentCell}>
              <Text style={styles.historyHeaderText}>学歴・職歴</Text>
            </View>
          </View>

          {/* 学歴 */}
          <SectionLabelRow label="学 歴" />
          {data.education.map((entry, i) => (
            <HistoryRow key={`edu-${i}`} entry={entry} />
          ))}

          {/* 職歴 */}
          <SectionLabelRow label="職 歴" />
          {data.workHistory.map((entry, i) => (
            <HistoryRow key={`work-${i}`} entry={entry} />
          ))}

          {/* 以上 */}
          <HistoryRow
            entry={{ year: "", month: "", content: "以上" }}
          />

          {/* 余白行 */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <EmptyHistoryRow
              key={`empty-hist-${i}`}
              isLast={i === emptyRows - 1}
            />
          ))}
        </View>

        {/* ── 資格・免許 ── */}
        <View style={styles.qualTable}>
          <View style={styles.historyHeaderRow}>
            <View style={styles.historyYearCell}>
              <Text style={styles.historyHeaderText}>年</Text>
            </View>
            <View style={styles.historyMonthCell}>
              <Text style={styles.historyHeaderText}>月</Text>
            </View>
            <View style={styles.historyContentCell}>
              <Text style={styles.historyHeaderText}>資格・免許</Text>
            </View>
          </View>
          {data.qualifications.map((entry, i) => (
            <HistoryRow key={`qual-${i}`} entry={entry} />
          ))}
          {Array.from({ length: qualEmptyRows }).map((_, i) => (
            <EmptyHistoryRow
              key={`empty-qual-${i}`}
              isLast={
                i === qualEmptyRows - 1 &&
                data.qualifications.length + i + 1 >= MIN_QUAL_ROWS
              }
            />
          ))}
        </View>

        {/* ── 志望動機 ── */}
        <View style={styles.textBoxContainer}>
          <View style={styles.textBoxHeader}>
            <Text style={styles.textBoxHeaderText}>志望動機</Text>
          </View>
          <View style={styles.textBoxBody}>
            <Text style={styles.textBoxText}>
              {data.motivation || ""}
            </Text>
          </View>
        </View>

        {/* ── 自己PR ── */}
        <View style={styles.textBoxContainer}>
          <View style={styles.textBoxHeader}>
            <Text style={styles.textBoxHeaderText}>自己PR</Text>
          </View>
          <View style={styles.textBoxBody}>
            <Text style={styles.textBoxText}>{data.selfPr || ""}</Text>
          </View>
        </View>

        {/* ── 本人希望欄 ── */}
        <View style={styles.textBoxContainer}>
          <View style={styles.textBoxHeader}>
            <Text style={styles.textBoxHeaderText}>本人希望欄</Text>
          </View>
          <View style={styles.textBoxBody}>
            <Text style={styles.textBoxText}>
              {data.requests || "特になし"}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

/**
 * 西暦日付文字列を和暦（令和）に変換する。
 * 入力例: "2026-04-14" -> "令和8年4月14日"
 */
function toWareki(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  // 令和は2019年5月1日から
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear}年${month}月${day}日 `;
  }
  // 平成 (1989-2019)
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear}年${month}月${day}日 `;
  }

  return `${year}年${month}月${day}日 `;
}

export default ResumePdfDocument;
