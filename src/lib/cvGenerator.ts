/**
 * 日本式職務経歴書PDF生成モジュール
 *
 * PDFKitでA4縦の職務経歴書PDFを生成する。サーバーサイド(API Route)専用。
 * セクション: 職務要約 / 職務経歴 / スキル / 資格 / 自己PR
 */
import PDFDocument from "pdfkit";
import path from "path";

// ── 型定義 ──────────────────────────────────────────────

export interface CompanyBlock {
  period: string;
  companyName: string;
  business: string;
  employees?: string;
  department?: string;
  position?: string;
  duties: string[];
  achievements?: string[];
}

export interface SkillCategory {
  category: string;
  skills: string;
}

export interface CvData {
  name: string;
  date: string;
  summary: string;
  companies: CompanyBlock[];
  skills: SkillCategory[];
  qualifications: string[];
  selfPr: string;
}

// ── 定数 ────────────────────────────────────────────────

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const START_X = MARGIN;

const THICK_LINE = 1.5;
const THIN_LINE = 0.5;
const CELL_PADDING = 5;

const HEADER_BG = "#E8E8E8";
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_SECTION = 11;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 9;

// ── ヘルパー ────────────────────────────────────────────

/** セクションタイトルを描画し、Y座標を返す */
function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
): number {
  const lineY = y + FONT_SIZE_SECTION + 6;

  doc
    .font("NotoSansJP-Bold")
    .fontSize(FONT_SIZE_SECTION)
    .text(title, START_X, y);

  // 下線
  doc
    .lineWidth(1)
    .moveTo(START_X, lineY)
    .lineTo(START_X + CONTENT_WIDTH, lineY)
    .stroke();

  return lineY + 8;
}

/** 改ページが必要かチェックし、必要なら改ページして新しいY座標を返す */
function ensureSpace(
  doc: PDFKit.PDFDocument,
  currentY: number,
  neededHeight: number,
): number {
  if (currentY + neededHeight > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return currentY;
}

/** テーブルセル内にテキストを描画（折り返し対応）し、実際に使った高さを返す */
function measureText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
  fontName: string,
): number {
  doc.font(fontName).fontSize(fontSize);
  return doc.heightOfString(text, { width: width - 2 * CELL_PADDING });
}

/** 水平線を描画 */
function hLine(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  lineWidth: number,
): void {
  doc.lineWidth(lineWidth).moveTo(x, y).lineTo(x + width, y).stroke();
}

/** 垂直線を描画 */
function vLine(
  doc: PDFKit.PDFDocument,
  x: number,
  y1: number,
  y2: number,
  lineWidth: number,
): void {
  doc.lineWidth(lineWidth).moveTo(x, y1).lineTo(x, y2).stroke();
}

/** 矩形を描画（塗りつぶしオプション付き） */
function drawRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { fill?: string; lineWidth?: number },
): void {
  const lw = options?.lineWidth ?? THIN_LINE;
  if (options?.fill) {
    doc.rect(x, y, w, h).fillAndStroke(options.fill, "#000000");
    doc.fillColor("#000000");
  } else {
    doc.lineWidth(lw).rect(x, y, w, h).stroke();
  }
}

// ── 会社ブロック描画 ────────────────────────────────────

function drawCompanyBlock(
  doc: PDFKit.PDFDocument,
  company: CompanyBlock,
  y: number,
): number {
  const periodColWidth = 130;
  const mainColWidth = CONTENT_WIDTH - periodColWidth;
  const mainColX = START_X + periodColWidth;

  // ヘッダー行の内容を準備
  const companyInfo = company.employees
    ? `${company.companyName}　事業内容: ${company.business}　従業員数: ${company.employees}`
    : `${company.companyName}　事業内容: ${company.business}`;

  // ヘッダー行の高さを計算
  const periodHeight =
    measureText(doc, company.period, periodColWidth, FONT_SIZE_BODY, "NotoSansJP") +
    2 * CELL_PADDING;
  const companyInfoHeight =
    measureText(doc, companyInfo, mainColWidth, FONT_SIZE_BODY, "NotoSansJP-Bold") +
    2 * CELL_PADDING;
  const headerRowHeight = Math.max(periodHeight, companyInfoHeight, 24);

  // 部署・役職行
  let deptText = "";
  if (company.department) deptText += `【${company.department}】`;
  if (company.position) deptText += `　${company.position}`;
  const hasDeptRow = deptText.length > 0;
  const deptRowHeight = hasDeptRow
    ? measureText(doc, deptText, CONTENT_WIDTH, FONT_SIZE_BODY, "NotoSansJP") +
      2 * CELL_PADDING
    : 0;

  // 業務内容の高さを計算
  let dutiesHeight = 0;
  const dutiesLabel = "【業務内容】";
  dutiesHeight += measureText(doc, dutiesLabel, CONTENT_WIDTH - 2 * CELL_PADDING, FONT_SIZE_BODY, "NotoSansJP-Bold") + 3;
  for (const duty of company.duties) {
    dutiesHeight +=
      measureText(doc, `・${duty}`, CONTENT_WIDTH - 2 * CELL_PADDING - 10, FONT_SIZE_BODY, "NotoSansJP") + 2;
  }
  dutiesHeight += 2 * CELL_PADDING;

  // 実績の高さを計算
  let achievementsHeight = 0;
  if (company.achievements && company.achievements.length > 0) {
    const achLabel = "【実績・成果】";
    achievementsHeight += measureText(doc, achLabel, CONTENT_WIDTH - 2 * CELL_PADDING, FONT_SIZE_BODY, "NotoSansJP-Bold") + 3;
    for (const ach of company.achievements) {
      achievementsHeight +=
        measureText(doc, `・${ach}`, CONTENT_WIDTH - 2 * CELL_PADDING - 10, FONT_SIZE_BODY, "NotoSansJP") + 2;
    }
    achievementsHeight += 2 * CELL_PADDING;
  }

  const totalHeight = headerRowHeight + deptRowHeight + dutiesHeight + achievementsHeight;
  y = ensureSpace(doc, y, totalHeight);

  let currentY = y;

  // --- ヘッダー行（グレー背景）---
  // 背景
  doc.lineWidth(THICK_LINE);
  doc
    .rect(START_X, currentY, CONTENT_WIDTH, headerRowHeight)
    .fillAndStroke(HEADER_BG, "#000000");
  doc.fillColor("#000000");

  // 縦線（期間 | 会社情報）
  vLine(doc, mainColX, currentY, currentY + headerRowHeight, THIN_LINE);

  // 期間テキスト
  doc
    .font("NotoSansJP")
    .fontSize(FONT_SIZE_BODY)
    .text(company.period, START_X + CELL_PADDING, currentY + CELL_PADDING, {
      width: periodColWidth - 2 * CELL_PADDING,
    });

  // 会社情報テキスト
  doc
    .font("NotoSansJP-Bold")
    .fontSize(FONT_SIZE_BODY)
    .text(companyInfo, mainColX + CELL_PADDING, currentY + CELL_PADDING, {
      width: mainColWidth - 2 * CELL_PADDING,
    });

  currentY += headerRowHeight;

  // --- 部署・役職行 ---
  if (hasDeptRow) {
    doc.lineWidth(THIN_LINE);
    drawRect(doc, START_X, currentY, CONTENT_WIDTH, deptRowHeight, {
      lineWidth: THIN_LINE,
    });

    doc
      .font("NotoSansJP")
      .fontSize(FONT_SIZE_BODY)
      .text(deptText, START_X + CELL_PADDING, currentY + CELL_PADDING, {
        width: CONTENT_WIDTH - 2 * CELL_PADDING,
      });

    currentY += deptRowHeight;
  }

  // --- 業務内容 ---
  doc.lineWidth(THIN_LINE);
  drawRect(doc, START_X, currentY, CONTENT_WIDTH, dutiesHeight, {
    lineWidth: THIN_LINE,
  });

  let textY = currentY + CELL_PADDING;
  doc.font("NotoSansJP-Bold").fontSize(FONT_SIZE_BODY).text(dutiesLabel, START_X + CELL_PADDING, textY);
  textY += measureText(doc, dutiesLabel, CONTENT_WIDTH - 2 * CELL_PADDING, FONT_SIZE_BODY, "NotoSansJP-Bold") + 3;

  doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
  for (const duty of company.duties) {
    const bulletText = `・${duty}`;
    doc.text(bulletText, START_X + CELL_PADDING + 10, textY, {
      width: CONTENT_WIDTH - 2 * CELL_PADDING - 10,
    });
    textY += measureText(doc, bulletText, CONTENT_WIDTH - 2 * CELL_PADDING - 10, FONT_SIZE_BODY, "NotoSansJP") + 2;
  }

  currentY += dutiesHeight;

  // --- 実績・成果 ---
  if (company.achievements && company.achievements.length > 0) {
    doc.lineWidth(THIN_LINE);
    drawRect(doc, START_X, currentY, CONTENT_WIDTH, achievementsHeight, {
      lineWidth: THIN_LINE,
    });

    textY = currentY + CELL_PADDING;
    const achLabel = "【実績・成果】";
    doc.font("NotoSansJP-Bold").fontSize(FONT_SIZE_BODY).text(achLabel, START_X + CELL_PADDING, textY);
    textY += measureText(doc, achLabel, CONTENT_WIDTH - 2 * CELL_PADDING, FONT_SIZE_BODY, "NotoSansJP-Bold") + 3;

    doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
    for (const ach of company.achievements) {
      const bulletText = `・${ach}`;
      doc.text(bulletText, START_X + CELL_PADDING + 10, textY, {
        width: CONTENT_WIDTH - 2 * CELL_PADDING - 10,
      });
      textY += measureText(doc, bulletText, CONTENT_WIDTH - 2 * CELL_PADDING - 10, FONT_SIZE_BODY, "NotoSansJP") + 2;
    }

    currentY += achievementsHeight;
  }

  // 外枠を太線で上書き
  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, y, CONTENT_WIDTH, currentY - y).stroke();

  return currentY;
}

// ── スキルテーブル描画 ──────────────────────────────────

function drawSkillTable(
  doc: PDFKit.PDFDocument,
  skills: SkillCategory[],
  y: number,
): number {
  const catColWidth = 120;
  const skillColWidth = CONTENT_WIDTH - catColWidth;
  const catColX = START_X;
  const skillColX = START_X + catColWidth;

  // ヘッダー行
  const headerHeight = 22;
  y = ensureSpace(doc, y, headerHeight + 22 * skills.length);

  const tableStartY = y;

  // ヘッダー背景
  doc
    .rect(START_X, y, CONTENT_WIDTH, headerHeight)
    .fillAndStroke(HEADER_BG, "#000000");
  doc.fillColor("#000000");

  // ヘッダーテキスト
  doc
    .font("NotoSansJP-Bold")
    .fontSize(FONT_SIZE_BODY)
    .text("カテゴリ", catColX + CELL_PADDING, y + CELL_PADDING)
    .text("スキル", skillColX + CELL_PADDING, y + CELL_PADDING);

  // 縦線
  vLine(doc, skillColX, y, y + headerHeight, THIN_LINE);

  y += headerHeight;

  // 各行
  for (const skill of skills) {
    const catHeight =
      measureText(doc, skill.category, catColWidth, FONT_SIZE_BODY, "NotoSansJP-Bold") +
      2 * CELL_PADDING;
    const skillHeight =
      measureText(doc, skill.skills, skillColWidth, FONT_SIZE_BODY, "NotoSansJP") +
      2 * CELL_PADDING;
    const rowHeight = Math.max(catHeight, skillHeight, 20);

    y = ensureSpace(doc, y, rowHeight);

    // 行の背景（白）
    doc.lineWidth(THIN_LINE).rect(START_X, y, CONTENT_WIDTH, rowHeight).stroke();

    // 縦線
    vLine(doc, skillColX, y, y + rowHeight, THIN_LINE);

    // テキスト
    doc
      .font("NotoSansJP-Bold")
      .fontSize(FONT_SIZE_BODY)
      .text(skill.category, catColX + CELL_PADDING, y + CELL_PADDING, {
        width: catColWidth - 2 * CELL_PADDING,
      });
    doc
      .font("NotoSansJP")
      .fontSize(FONT_SIZE_BODY)
      .text(skill.skills, skillColX + CELL_PADDING, y + CELL_PADDING, {
        width: skillColWidth - 2 * CELL_PADDING,
      });

    y += rowHeight;
  }

  // 外枠太線
  doc.lineWidth(THICK_LINE).rect(START_X, tableStartY, CONTENT_WIDTH, y - tableStartY).stroke();

  return y;
}

// ── PDF生成メイン ────────────────────────────────────────

/**
 * CvData を受け取り、日本式職務経歴書PDFバッファを返す。
 *
 * Args:
 *   data: 構造化された職務経歴書データ
 *
 * Returns:
 *   PDFバイナリの Buffer
 */
export async function generateCvPdf(data: CvData): Promise<Buffer> {
  const fontRegular = path.join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "NotoSansJP-Bold.ttf");

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
  });

  // フォント登録
  doc.registerFont("NotoSansJP", fontRegular);
  doc.registerFont("NotoSansJP-Bold", fontBold);
  doc.font("NotoSansJP");

  let y = MARGIN;

  // ── タイトル「職 務 経 歴 書」──
  doc
    .font("NotoSansJP-Bold")
    .fontSize(FONT_SIZE_TITLE);
  const titleText = "職 務 経 歴 書";
  const titleWidth = doc.widthOfString(titleText, { characterSpacing: 10 });
  doc.text(titleText, (PAGE_WIDTH - titleWidth) / 2, y, { characterSpacing: 10 });
  y += FONT_SIZE_TITLE + 12;

  // ── 日付・氏名（右揃え） ──
  doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
  const dateText = data.date;
  const nameText = data.name;
  const dateWidth = doc.widthOfString(dateText);
  const nameWidth = doc.widthOfString(nameText);
  doc.text(dateText, START_X + CONTENT_WIDTH - dateWidth, y);
  y += FONT_SIZE_BODY + 4;
  doc.text(nameText, START_X + CONTENT_WIDTH - nameWidth, y);
  y += FONT_SIZE_BODY + 16;

  // ── 職務要約 ──
  y = drawSectionTitle(doc, "\u25a0 職務要約", y);
  doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
  doc.text(data.summary, START_X, y, {
    width: CONTENT_WIDTH,
    lineGap: 3,
  });
  y += doc.heightOfString(data.summary, { width: CONTENT_WIDTH, lineGap: 3 }) + 16;

  // ── 職務経歴 ──
  y = drawSectionTitle(doc, "\u25a0 職務経歴", y);
  for (const company of data.companies) {
    y = ensureSpace(doc, y, 80);
    y = drawCompanyBlock(doc, company, y);
    y += 10;
  }
  y += 6;

  // ── 活かせる経験・スキル ──
  y = ensureSpace(doc, y, 60);
  y = drawSectionTitle(doc, "\u25a0 活かせる経験・スキル", y);
  y = drawSkillTable(doc, data.skills, y);
  y += 16;

  // ── 資格・免許 ──
  if (data.qualifications.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, "\u25a0 資格・免許", y);
    doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
    for (const qual of data.qualifications) {
      y = ensureSpace(doc, y, 18);
      const bulletText = `・${qual}`;
      doc.text(bulletText, START_X + 5, y);
      y += doc.heightOfString(bulletText, { width: CONTENT_WIDTH - 5 }) + 3;
    }
    y += 12;
  }

  // ── 自己PR ──
  if (data.selfPr) {
    y = ensureSpace(doc, y, 60);
    y = drawSectionTitle(doc, "\u25a0 自己PR", y);
    doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
    doc.text(data.selfPr, START_X, y, {
      width: CONTENT_WIDTH,
      lineGap: 3,
    });
    y += doc.heightOfString(data.selfPr, { width: CONTENT_WIDTH, lineGap: 3 }) + 12;
  }

  // ── 「以上」 ──
  y = ensureSpace(doc, y, 20);
  doc.font("NotoSansJP").fontSize(FONT_SIZE_BODY);
  const ijouText = "以上";
  const ijouWidth = doc.widthOfString(ijouText);
  doc.text(ijouText, START_X + CONTENT_WIDTH - ijouWidth, y);

  // Buffer に書き出し
  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
