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

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 8,
  },
  date: {
    fontSize: 9,
    textAlign: "right",
    color: "#666666",
    marginBottom: 20,
  },
  heading2: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  heading3: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 6,
  },
  listItem: {
    fontSize: 10,
    marginBottom: 3,
    paddingLeft: 12,
  },
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    marginVertical: 8,
  },
});

interface MarkdownLine {
  type: "h1" | "h2" | "h3" | "paragraph" | "list" | "separator" | "empty";
  text: string;
}

/**
 * Markdownテキストを簡易パースして構造化する。
 * 対応: # h1, ## h2, ### h3, - リスト, --- 区切り線, 通常段落
 */
function parseMarkdown(markdown: string): MarkdownLine[] {
  const lines = markdown.split("\n");
  const result: MarkdownLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      result.push({ type: "empty", text: "" });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      result.push({ type: "separator", text: "" });
      continue;
    }

    if (line.startsWith("### ")) {
      result.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      result.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("# ")) {
      result.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "").trim();
      result.push({ type: "list", text: `- ${text}` });
      continue;
    }

    // Markdownの装飾記号を除去（太字・斜体）
    const cleaned = line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/_(.+?)_/g, "$1");

    result.push({ type: "paragraph", text: cleaned });
  }

  return result;
}

interface PdfDocumentProps {
  title: string;
  content: string;
  date: string;
}

const PdfDocument: React.FC<PdfDocumentProps> = ({ title, content, date }) => {
  const parsed = parseMarkdown(content);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>作成日: {date}</Text>

        {parsed.map((line, idx) => {
          switch (line.type) {
            case "h1":
              return (
                <Text key={idx} style={styles.title}>
                  {line.text}
                </Text>
              );
            case "h2":
              return (
                <Text key={idx} style={styles.heading2}>
                  {line.text}
                </Text>
              );
            case "h3":
              return (
                <Text key={idx} style={styles.heading3}>
                  {line.text}
                </Text>
              );
            case "list":
              return (
                <Text key={idx} style={styles.listItem}>
                  {line.text}
                </Text>
              );
            case "separator":
              return <View key={idx} style={styles.separator} />;
            case "empty":
              return (
                <Text key={idx} style={{ marginBottom: 4 }}>
                  {" "}
                </Text>
              );
            case "paragraph":
            default:
              return (
                <Text key={idx} style={styles.paragraph}>
                  {line.text}
                </Text>
              );
          }
        })}
      </Page>
    </Document>
  );
};

export default PdfDocument;
