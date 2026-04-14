/**
 * JIS規格準拠の履歴書PDF生成モジュール
 *
 * rirekisho-cli (MIT) の描画ロジックを参考に、PDFKitでA4 2ページの
 * 履歴書PDFを生成する。サーバーサイド(API Route)専用。
 */
import PDFDocument from "pdfkit";
import path from "path";

// ── 型定義 ──────────────────────────────────────────────

export interface ResumeAddress {
  zip: string;
  ruby: string;
  value: string;
  phone: string;
}

export interface ResumePersonal {
  name: string;
  ruby: string;
  birthDay: string; // ISO "YYYY-MM-DD"
  gender: string;
  email: string;
  phone: string;
  address: ResumeAddress;
}

export interface HistoryEntry {
  year: number;
  month: number;
  value: string;
}

export interface ResumeData {
  personal: ResumePersonal;
  education: HistoryEntry[];
  experience: HistoryEntry[];
  licences: HistoryEntry[];
  commutingTime?: string;
  dependents?: string;
  spouse?: string;
  hobby?: string;
  motivation: string;
  request?: string;
}

// ── 定数 ────────────────────────────────────────────────

const PAGE_WIDTH = 595.28; // A4 width (pt)
const PAGE_HEIGHT = 841.89; // A4 height (pt)
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const START_X = MARGIN;

const THICK_LINE = 2;
const THIN_LINE = 1;

// ── ヘルパー ────────────────────────────────────────────

function calcAge(birthIso: string): number {
  const birth = new Date(birthIso);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatBirthDay(birthIso: string): string {
  const d = new Date(birthIso);
  if (isNaN(d.getTime())) return "";
  const age = calcAge(birthIso);
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日（満 ${age} 歳）`;
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}年 ${now.getMonth() + 1}月 ${now.getDate()}日現在`;
}

// ── PDF生成メイン ────────────────────────────────────────

/**
 * ResumeData を受け取り、JIS規格準拠の履歴書PDFバッファを返す。
 *
 * Args:
 *   data: 構造化された履歴書データ
 *
 * Returns:
 *   PDFバイナリの Buffer
 */
export async function generateResumePdf(data: ResumeData): Promise<Buffer> {
  // フォントパスの解決 (Next.js の public/ はプロジェクトルートから)
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

  // Page 1
  drawPage1(doc, data);

  // Page 2
  doc.addPage();
  drawPage2(doc, data);

  // Buffer に書き出し
  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// ── Page 1: 個人情報 + 学歴・職歴 ───────────────────────

function drawPage1(doc: PDFKit.PDFDocument, data: ResumeData): void {
  const personalInfoY = 100;
  const personalInfoHeight = 280;
  const offsetX = 120; // 写真欄のためのオフセット
  const offsetY = 160; // 個人情報下部のオフセット

  // -- タイトル --
  doc.fontSize(16);
  const titleText = "履歴書";
  const titleHeight = doc.heightOfString(titleText);
  doc.text(titleText, START_X + 4, personalInfoY - titleHeight - 4, {
    characterSpacing: 10,
  });

  // -- 作成日 --
  doc.fontSize(10);
  const dateText = todayString();
  const dateWidth = doc.widthOfString(dateText);
  const dateHeight = doc.heightOfString(dateText);
  doc.text(
    dateText,
    START_X + CONTENT_WIDTH - offsetX - dateWidth,
    personalInfoY - dateHeight - 4
  );

  doc.fontSize(9);

  // -- 個人情報の外枠（太線）--
  // L字型の変形枠: 右上に写真欄用の切り欠き
  doc.lineWidth(THICK_LINE);
  doc
    .moveTo(START_X, personalInfoY)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + personalInfoHeight - offsetY)
    .lineTo(START_X + CONTENT_WIDTH, personalInfoY + personalInfoHeight - offsetY)
    .lineTo(START_X + CONTENT_WIDTH, personalInfoY + personalInfoHeight)
    .lineTo(START_X, personalInfoY + personalInfoHeight)
    .lineTo(START_X, personalInfoY)
    .stroke();
  doc.lineWidth(THIN_LINE);

  // -- 写真枠 --
  const photoX = START_X + CONTENT_WIDTH - offsetX + 20;
  const photoY = personalInfoY - 20;
  const photoWidth = 90;
  const photoHeight = 120;
  doc.rect(photoX, photoY, photoWidth, photoHeight).dash(1, { space: 5 }).stroke().undash();

  // 写真プレースホルダーテキスト
  doc.fontSize(12);
  const photoLabel = "写真";
  const photoLabelW = doc.widthOfString(photoLabel);
  const photoLabelH = doc.heightOfString(photoLabel);
  doc.text(photoLabel, photoX + (photoWidth - photoLabelW) / 2, photoY + (photoHeight - photoLabelH) / 2);
  doc.fontSize(8);
  const photoNote = "縦4cm×横3cm";
  const photoNoteW = doc.widthOfString(photoNote);
  doc.text(photoNote, photoX + (photoWidth - photoNoteW) / 2, photoY + photoHeight - 15);

  doc.fontSize(9);

  // -- ふりがな行 --
  doc.text("ふりがな", START_X + 5, personalInfoY + 3);
  if (data.personal.ruby) {
    doc.text(data.personal.ruby, START_X + 80, personalInfoY + 3);
  }
  doc
    .moveTo(START_X, personalInfoY + 20)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + 20)
    .dash(1, { space: 5 })
    .stroke()
    .undash();

  // -- 氏名行 --
  doc.text("氏名", START_X + 5, personalInfoY + 23, { characterSpacing: 16 });
  doc.fontSize(14);
  if (data.personal.name) {
    doc.text(data.personal.name, START_X + 80, personalInfoY + 28);
  }
  doc
    .moveTo(START_X, personalInfoY + 60)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + 60)
    .stroke();

  // -- 生年月日行 --
  doc.fontSize(9);
  doc.text("生年月日", START_X + 5, personalInfoY + 61);
  doc.fontSize(14);
  if (data.personal.birthDay) {
    doc.text(formatBirthDay(data.personal.birthDay), START_X + 80, personalInfoY + 68);
  }
  if (data.personal.gender) {
    doc.text(data.personal.gender, START_X + 360, personalInfoY + 68);
  }
  doc
    .moveTo(START_X, personalInfoY + 100)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + 100)
    .stroke()
    .moveTo(START_X + 50, personalInfoY + 60)
    .lineTo(START_X + 50, personalInfoY + 100)
    .stroke()
    .moveTo(START_X + 320, personalInfoY + 60)
    .lineTo(START_X + 320, personalInfoY + 100)
    .stroke();

  // -- 連絡先行（携帯電話・EMAIL）--
  doc.fontSize(9);
  doc.text("携帯電話番号", START_X + 5, personalInfoY + 103);
  if (data.personal.phone) {
    doc.text(data.personal.phone, START_X + 80, personalInfoY + 103);
  }
  doc.text("E-MAIL", START_X + 186, personalInfoY + 103);
  if (data.personal.email) {
    doc.text(data.personal.email, START_X + 233, personalInfoY + 103);
  }
  doc
    .moveTo(START_X + 65, personalInfoY + 100)
    .lineTo(START_X + 65, personalInfoY + 120)
    .dash(1, { space: 5 })
    .stroke()
    .undash()
    .moveTo(START_X + 180, personalInfoY + 100)
    .lineTo(START_X + 180, personalInfoY + 120)
    .stroke()
    .moveTo(START_X + 225, personalInfoY + 100)
    .lineTo(START_X + 225, personalInfoY + 120)
    .dash(1, { space: 5 })
    .stroke()
    .undash();

  // -- 写真下の電話・FAX欄 --
  const phoneFaxY = personalInfoY + 120;
  const phoneFaxHalfHeight = (personalInfoY + personalInfoHeight - phoneFaxY) / 2;
  const phoneFaxHalfY = phoneFaxY + phoneFaxHalfHeight;

  doc.text("電話", START_X + CONTENT_WIDTH - 116, personalInfoY + 122);
  if (data.personal.address.phone) {
    doc.text(data.personal.address.phone, START_X + CONTENT_WIDTH - 116, personalInfoY + 139);
  }

  doc
    .moveTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxY)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + personalInfoHeight)
    .moveTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxHalfY)
    .lineTo(START_X + CONTENT_WIDTH, phoneFaxHalfY)
    .stroke()
    .dash(1, { space: 5 })
    .moveTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxY + phoneFaxHalfHeight / 2)
    .lineTo(START_X + CONTENT_WIDTH, phoneFaxY + phoneFaxHalfHeight / 2)
    .moveTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxHalfY + phoneFaxHalfHeight / 2)
    .lineTo(START_X + CONTENT_WIDTH, phoneFaxHalfY + phoneFaxHalfHeight / 2)
    .stroke()
    .undash();

  // -- 住所行1 --
  doc.text("ふりがな", START_X + 5, personalInfoY + 123);
  if (data.personal.address.ruby) {
    doc.text(data.personal.address.ruby, START_X + 60, personalInfoY + 123);
  }

  doc.text("現住所 〒", START_X + 5, personalInfoY + 143);
  if (data.personal.address.zip) {
    doc.text(data.personal.address.zip, START_X + 60, personalInfoY + 143);
  }
  doc.fontSize(12);
  if (data.personal.address.value) {
    doc.text(data.personal.address.value, START_X + 60, personalInfoY + 163);
  }
  doc.fontSize(9);
  doc
    .moveTo(START_X, personalInfoY + 120)
    .lineTo(START_X + CONTENT_WIDTH - 110, personalInfoY + 120)
    .stroke();
  doc
    .moveTo(START_X, personalInfoY + 140)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, personalInfoY + 140)
    .dash(1, { space: 5 })
    .stroke()
    .undash();

  // -- 連絡先行2 --
  doc.text("ふりがな", START_X + 5, phoneFaxHalfY + 3);
  doc.text("連絡先 〒", START_X + 5, phoneFaxHalfY + 23);
  doc
    .moveTo(START_X, phoneFaxHalfY)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxHalfY)
    .stroke();
  doc
    .moveTo(START_X, phoneFaxHalfY + 20)
    .lineTo(START_X + CONTENT_WIDTH - offsetX, phoneFaxHalfY + 20)
    .dash(1, { space: 5 })
    .stroke()
    .undash();

  // ── 学歴・職歴セクション ──
  const educationWorkY = personalInfoY + personalInfoHeight + 30;
  const educationWorkHeight = 370;

  // 表ヘッダー
  doc.text("年", START_X + 26, educationWorkY + 6);
  doc.text("月", START_X + 76, educationWorkY + 6);
  doc.text("学歴・職歴", START_X + 295, educationWorkY + 6);

  // 外枠（太線）
  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, educationWorkY, CONTENT_WIDTH, educationWorkHeight).stroke();
  doc.lineWidth(THIN_LINE);

  // ヘッダー行
  doc
    .moveTo(START_X, educationWorkY + 25)
    .lineTo(START_X + CONTENT_WIDTH, educationWorkY + 25)
    .stroke();

  // 縦線（年列・月列）
  doc
    .moveTo(START_X + 60, educationWorkY)
    .lineTo(START_X + 60, educationWorkY + educationWorkHeight)
    .stroke();
  doc
    .moveTo(START_X + 100, educationWorkY)
    .lineTo(START_X + 100, educationWorkY + educationWorkHeight)
    .stroke();

  // 各行の横線（最大14行）
  for (let i = 1; i <= 14; i++) {
    const y = educationWorkY + 25 + i * 23;
    if (y < educationWorkY + educationWorkHeight) {
      doc
        .moveTo(START_X, y)
        .lineTo(START_X + CONTENT_WIDTH, y)
        .stroke();
    }
  }

  // 学歴・職歴データの描画
  let rowIndex = 0;

  if (data.education.length > 0) {
    doc.fontSize(12);
    doc.text("学歴", START_X + 305, educationWorkY + 26);
    rowIndex++;

    for (let i = 0; i < data.education.length; i++) {
      const y = educationWorkY + 26 + (i + rowIndex) * 23;
      const entry = data.education[i];
      doc.text(entry.year.toString(), START_X + 17, y);
      doc.text(entry.month.toString(), START_X + 71, y, {
        align: "center",
        width: 20,
      });
      doc.text(entry.value, START_X + 110, y + 1);
    }
    rowIndex += data.education.length;
  }

  if (data.experience.length > 0) {
    doc.fontSize(12);
    doc.text("職歴", START_X + 305, educationWorkY + 26 + rowIndex * 23);
    rowIndex++;

    for (let i = 0; i < data.experience.length; i++) {
      const y = educationWorkY + 26 + (i + rowIndex) * 23;
      const entry = data.experience[i];
      doc.text(entry.year.toString(), START_X + 17, y);
      doc.text(entry.month.toString(), START_X + 71, y, {
        align: "center",
        width: 20,
      });
      doc.text(entry.value, START_X + 110, y + 1);
    }
    rowIndex += data.experience.length;

    // 「以上」
    doc.text("以上", START_X + 480, educationWorkY + 26 + rowIndex * 23 + 1);
  }
}

// ── Page 2: 資格 + 通勤/扶養 + 趣味 + 志望動機 + 本人希望 ──

function drawPage2(doc: PDFKit.PDFDocument, data: ResumeData): void {
  // -- 資格・免許セクション --
  const certificateY = 100;
  const certificateHeight = 140;

  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, certificateY, CONTENT_WIDTH, certificateHeight).stroke();
  doc.lineWidth(THIN_LINE);

  doc.fontSize(9);
  doc.text("年", START_X + 26, certificateY + 6);
  doc.text("月", START_X + 76, certificateY + 6);
  doc.text("免許・資格", START_X + 295, certificateY + 6);

  doc
    .moveTo(START_X, certificateY + 25)
    .lineTo(START_X + CONTENT_WIDTH, certificateY + 25)
    .stroke();

  // 縦線
  doc
    .moveTo(START_X + 60, certificateY)
    .lineTo(START_X + 60, certificateY + certificateHeight)
    .stroke();
  doc
    .moveTo(START_X + 100, certificateY)
    .lineTo(START_X + 100, certificateY + certificateHeight)
    .stroke();

  // 行線
  for (let i = 1; i <= 4; i++) {
    const y = certificateY + 25 + i * 23;
    if (y < certificateY + certificateHeight) {
      doc
        .moveTo(START_X, y)
        .lineTo(START_X + CONTENT_WIDTH, y)
        .stroke();
    }
  }

  // 資格データ
  if (data.licences.length > 0) {
    doc.fontSize(12);
    for (let i = 0; i < data.licences.length; i++) {
      const y = certificateY + 26 + i * 23;
      const entry = data.licences[i];
      doc.text(entry.year.toString(), START_X + 17, y);
      doc.text(entry.month.toString(), START_X + 71, y, {
        align: "center",
        width: 20,
      });
      doc.text(entry.value, START_X + 110, y + 1);
    }
  }

  // -- 通勤時間・扶養家族等 --
  const infoY = certificateY + certificateHeight + 20;
  const infoHeight = 50;

  doc.fontSize(9);
  doc.text("通勤時間", START_X + 6, infoY + 4);
  doc.text("扶養家族", START_X + 140, infoY + 4);
  doc.text("配偶者", START_X + 275, infoY + 4);
  doc.text("配偶者の扶養義務", START_X + 408, infoY + 4);

  doc.fontSize(12);
  if (data.commutingTime) {
    doc.text(data.commutingTime, START_X, infoY + 24, {
      align: "center",
      width: 138,
    });
  }
  if (data.dependents) {
    doc.text(data.dependents, START_X + 134, infoY + 24, {
      align: "center",
      width: 138,
    });
  }
  if (data.spouse) {
    doc.text(data.spouse, START_X + 263, infoY + 24, {
      align: "center",
      width: 138,
    });
  }

  doc.fontSize(9);

  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, infoY, CONTENT_WIDTH, infoHeight).stroke();
  doc.lineWidth(THIN_LINE);

  // 4分割の縦線
  doc
    .moveTo(START_X + CONTENT_WIDTH / 4, infoY)
    .lineTo(START_X + CONTENT_WIDTH / 4, infoY + infoHeight)
    .stroke();
  doc
    .moveTo(START_X + CONTENT_WIDTH / 2, infoY)
    .lineTo(START_X + CONTENT_WIDTH / 2, infoY + infoHeight)
    .stroke();
  doc
    .moveTo(START_X + (3 * CONTENT_WIDTH) / 4, infoY)
    .lineTo(START_X + (3 * CONTENT_WIDTH) / 4, infoY + infoHeight)
    .stroke();

  // -- 趣味・特技セクション --
  const hobbyY = infoY + infoHeight + 20;
  const hobbyHeight = 120;

  doc.text("趣味・特技", START_X + 7, hobbyY + 5);
  doc.fontSize(12);
  if (data.hobby) {
    doc.text(data.hobby, START_X + 7, hobbyY + 24, {
      align: "left",
      width: CONTENT_WIDTH - START_X - 14,
    });
  }

  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, hobbyY, CONTENT_WIDTH, hobbyHeight).stroke();
  doc.lineWidth(THIN_LINE);

  // -- 志望動機セクション --
  const motivationY = hobbyY + hobbyHeight + 20;
  const motivationHeight = 120;

  doc.fontSize(9);
  doc.text("志望動機", START_X + 7, motivationY + 5);
  doc.fontSize(12);
  if (data.motivation) {
    doc.text(data.motivation, START_X + 7, motivationY + 24, {
      align: "left",
      width: CONTENT_WIDTH - START_X - 14,
    });
  }

  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, motivationY, CONTENT_WIDTH, motivationHeight).stroke();
  doc.lineWidth(THIN_LINE);

  // -- 本人希望記入欄 --
  const requestY = motivationY + motivationHeight + 20;
  const requestHeight = 120;

  doc.fontSize(9);
  doc.text("本人希望記入欄", START_X + 7, requestY + 5);
  doc.fontSize(12);
  if (data.request) {
    doc.text(data.request, START_X + 7, requestY + 24, {
      align: "left",
      width: CONTENT_WIDTH - START_X - 14,
    });
  }

  doc.lineWidth(THICK_LINE);
  doc.rect(START_X, requestY, CONTENT_WIDTH, requestHeight).stroke();
  doc.lineWidth(THIN_LINE);
}
