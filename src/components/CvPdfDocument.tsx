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

// --- 型定義 ---

interface CompanyBlock {
  heading: string;
  period: string;
  companyName: string;
  details: string;
  bullets: string[];
}

interface SkillEntry {
  category: string;
  skills: string;
}

interface CvSections {
  summary: string;
  companies: CompanyBlock[];
  skills: SkillEntry[];
  qualifications: string[];
  selfPr: string;
}

// --- Markdownパーサー ---

/**
 * Markdownの装飾記号を除去する。
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}

/**
 * 会社ヘッダー（### 行）から期間と会社名を抽出する。
 * 例: "株式会社テスト（2021年4月〜現在）" → { period: "2021年4月〜現在", companyName: "株式会社テスト" }
 */
function parseCompanyHeading(heading: string): { period: string; companyName: string; details: string } {
  const cleaned = stripMarkdown(heading);

  // パターン1: 会社名（期間）
  const parenMatch = cleaned.match(/^(.+?)[（(](.+?)[）)](.*)$/);
  if (parenMatch) {
    return {
      companyName: parenMatch[1].trim(),
      period: parenMatch[2].trim(),
      details: parenMatch[3].trim(),
    };
  }

  // パターン2: 期間 会社名
  const periodFirst = cleaned.match(/^(\d{4}年\d{1,2}月[〜~～―-].+?)\s+(.+)$/);
  if (periodFirst) {
    return {
      period: periodFirst[1].trim(),
      companyName: periodFirst[2].trim(),
      details: "",
    };
  }

  return { companyName: cleaned, period: "", details: "" };
}

/**
 * スキル行をカテゴリとスキル一覧に分解する。
 * 例: "- プログラミング: Python / Django / Flask" → { category: "プログラミング", skills: "Python / Django / Flask" }
 * 例: "- Python / Django / Flask" → { category: "", skills: "Python / Django / Flask" }
 */
function parseSkillLine(line: string): SkillEntry {
  const cleaned = line.replace(/^\s*[-*]\s+/, "").trim();
  const colonMatch = cleaned.match(/^(.+?)[：:](.+)$/);
  if (colonMatch) {
    return { category: colonMatch[1].trim(), skills: colonMatch[2].trim() };
  }
  return { category: "", skills: cleaned };
}

/**
 * AIが返すMarkdownを職務経歴書セクションに分解する。
 */
function parseCvMarkdown(markdown: string): CvSections {
  const lines = markdown.split("\n");
  const sections: CvSections = {
    summary: "",
    companies: [],
    skills: [],
    qualifications: [],
    selfPr: "",
  };

  type SectionKey = "summary" | "career" | "skills" | "qualifications" | "selfPr" | "none";
  let currentSection: SectionKey = "none";
  let currentCompany: CompanyBlock | null = null;
  const buffer: string[] = [];

  const flushBuffer = (): string => {
    const text = buffer.join("\n").trim();
    buffer.length = 0;
    return text;
  };

  const flushCompany = (): void => {
    if (currentCompany) {
      sections.companies.push(currentCompany);
      currentCompany = null;
    }
  };

  const detectSection = (heading: string): SectionKey => {
    const h = heading.toLowerCase();
    if (h.includes("職務要約") || h.includes("概要") || h.includes("サマリ")) return "summary";
    if (h.includes("職務経歴") || h.includes("経歴") || h.includes("職歴")) return "career";
    if (h.includes("スキル") || h.includes("技術") || h.includes("テクニカル")) return "skills";
    if (h.includes("資格") || h.includes("免許") || h.includes("認定")) return "qualifications";
    if (h.includes("自己pr") || h.includes("自己ＰＲ") || h.includes("アピール") || h.includes("自己紹介")) return "selfPr";
    return "none";
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // ## レベルのヘッダー: セクション切り替え
    if (line.startsWith("## ")) {
      // 現在のバッファを処理
      if (currentSection === "summary") sections.summary = flushBuffer();
      if (currentSection === "selfPr") sections.selfPr = flushBuffer();
      flushCompany();

      const heading = line.slice(3).trim();
      currentSection = detectSection(heading);
      continue;
    }

    // ### レベルのヘッダー: 会社ブロック開始（職務経歴セクション内）
    if (line.startsWith("### ") && currentSection === "career") {
      flushCompany();
      const heading = line.slice(4).trim();
      const parsed = parseCompanyHeading(heading);
      currentCompany = {
        heading,
        period: parsed.period,
        companyName: parsed.companyName,
        details: parsed.details,
        bullets: [],
      };
      continue;
    }

    // 箇条書き
    if (/^\s*[-*]\s+/.test(line)) {
      const bulletText = stripMarkdown(line.replace(/^\s*[-*]\s+/, "").trim());

      if (currentSection === "career" && currentCompany) {
        currentCompany.bullets.push(bulletText);
      } else if (currentSection === "skills") {
        sections.skills.push(parseSkillLine(line));
      } else if (currentSection === "qualifications") {
        sections.qualifications.push(bulletText);
      } else if (currentSection === "summary" || currentSection === "selfPr") {
        buffer.push(bulletText);
      }
      continue;
    }

    // 通常テキスト
    if (line.trim() !== "") {
      const cleaned = stripMarkdown(line);
      if (currentSection === "summary" || currentSection === "selfPr") {
        buffer.push(cleaned);
      } else if (currentSection === "career" && currentCompany) {
        // 会社ブロック内の通常テキスト（事業内容など）
        currentCompany.details = currentCompany.details
          ? `${currentCompany.details} ${cleaned}`
          : cleaned;
      }
    }
  }

  // 最後のバッファを処理
  if (currentSection === "summary") sections.summary = flushBuffer();
  if (currentSection === "selfPr") sections.selfPr = flushBuffer();
  flushCompany();

  return sections;
}

// --- スタイル ---

const BORDER_COLOR = "#000000";
const BORDER_WIDTH = 0.75;
const HEADER_BG = "#f0f0f0";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  // ヘッダー
  docTitle: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 4,
  },
  headerRight: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  // セクションヘッダー
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: HEADER_BG,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 0,
  },
  // 職務要約
  summaryBox: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderTopWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  summaryText: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  // 職務経歴テーブル
  careerTable: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderTopWidth: 0,
  },
  careerHeaderRow: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  careerRow: {
    flexDirection: "row",
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  careerRowLast: {
    flexDirection: "row",
  },
  periodCell: {
    width: "22%",
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  contentCell: {
    width: "78%",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  periodText: {
    fontSize: 8,
  },
  companyName: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
  },
  companyDetails: {
    fontSize: 8,
    color: "#444444",
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 9,
    marginBottom: 2,
    paddingLeft: 4,
  },
  // スキルテーブル
  skillTable: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderTopWidth: 0,
  },
  skillHeaderRow: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  skillRow: {
    flexDirection: "row",
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  skillRowLast: {
    flexDirection: "row",
  },
  skillCategoryCell: {
    width: "25%",
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  skillValueCell: {
    width: "75%",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  skillCategoryText: {
    fontSize: 9,
    fontWeight: 700,
  },
  skillValueText: {
    fontSize: 9,
  },
  // 資格テーブル
  qualTable: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderTopWidth: 0,
  },
  qualRow: {
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  qualRowLast: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  qualText: {
    fontSize: 9,
  },
  // 自己PR
  prBox: {
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderTopWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  prText: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  // テーブルヘッダーテキスト
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 700,
  },
  // 以上
  footer: {
    fontSize: 9,
    textAlign: "right",
    marginTop: 16,
  },
});

// --- コンポーネント ---

interface CvPdfDocumentProps {
  content: string;
  date: string;
  authorName?: string;
}

const CvPdfDocument: React.FC<CvPdfDocumentProps> = ({ content, date, authorName }) => {
  const cv = parseCvMarkdown(content);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* タイトル */}
        <Text style={styles.docTitle}>職 務 経 歴 書</Text>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerRight}>{date}</Text>
            {authorName ? <Text style={styles.headerRight}>{authorName}</Text> : null}
          </View>
        </View>

        {/* 職務要約 */}
        {cv.summary ? (
          <>
            <Text style={styles.sectionTitle}>職務要約</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{cv.summary}</Text>
            </View>
          </>
        ) : null}

        {/* 職務経歴 */}
        {cv.companies.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>職務経歴</Text>
            <View style={styles.careerTable}>
              {/* テーブルヘッダー */}
              <View style={styles.careerHeaderRow}>
                <View style={styles.periodCell}>
                  <Text style={styles.tableHeaderText}>期間</Text>
                </View>
                <View style={styles.contentCell}>
                  <Text style={styles.tableHeaderText}>会社名・業務内容</Text>
                </View>
              </View>
              {/* 各会社 */}
              {cv.companies.map((company, idx) => {
                const isLast = idx === cv.companies.length - 1;
                return (
                  <View
                    key={idx}
                    style={isLast ? styles.careerRowLast : styles.careerRow}
                    wrap={false}
                  >
                    <View style={styles.periodCell}>
                      <Text style={styles.periodText}>{company.period || "---"}</Text>
                    </View>
                    <View style={styles.contentCell}>
                      <Text style={styles.companyName}>{company.companyName}</Text>
                      {company.details ? (
                        <Text style={styles.companyDetails}>{company.details}</Text>
                      ) : null}
                      {company.bullets.map((bullet, bIdx) => (
                        <Text key={bIdx} style={styles.bulletItem}>
                          ・{bullet}
                        </Text>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* スキル・技術 */}
        {cv.skills.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>スキル・技術</Text>
            <View style={styles.skillTable}>
              {/* テーブルヘッダー */}
              <View style={styles.skillHeaderRow}>
                <View style={styles.skillCategoryCell}>
                  <Text style={styles.tableHeaderText}>カテゴリ</Text>
                </View>
                <View style={styles.skillValueCell}>
                  <Text style={styles.tableHeaderText}>スキル</Text>
                </View>
              </View>
              {cv.skills.map((skill, idx) => {
                const isLast = idx === cv.skills.length - 1;
                return (
                  <View key={idx} style={isLast ? styles.skillRowLast : styles.skillRow}>
                    <View style={styles.skillCategoryCell}>
                      <Text style={styles.skillCategoryText}>{skill.category || "---"}</Text>
                    </View>
                    <View style={styles.skillValueCell}>
                      <Text style={styles.skillValueText}>{skill.skills}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* 資格 */}
        {cv.qualifications.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>資格・免許</Text>
            <View style={styles.qualTable}>
              {cv.qualifications.map((qual, idx) => {
                const isLast = idx === cv.qualifications.length - 1;
                return (
                  <View key={idx} style={isLast ? styles.qualRowLast : styles.qualRow}>
                    <Text style={styles.qualText}>{qual}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* 自己PR */}
        {cv.selfPr ? (
          <>
            <Text style={styles.sectionTitle}>自己PR</Text>
            <View style={styles.prBox}>
              <Text style={styles.prText}>{cv.selfPr}</Text>
            </View>
          </>
        ) : null}

        {/* 以上 */}
        <Text style={styles.footer}>以上</Text>
      </Page>
    </Document>
  );
};

export default CvPdfDocument;
