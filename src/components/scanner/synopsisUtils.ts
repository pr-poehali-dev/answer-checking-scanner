import { type SynopsisItem } from "@/store/appStore";

export function cyrToRtf(s: string): string {
  return Array.from(s).map(ch => {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      if (ch === "\\") return "\\\\";
      if (ch === "{") return "\\{";
      if (ch === "}") return "\\}";
      return ch;
    }
    return `\\u${code}?`;
  }).join("");
}

export function mdLineToRtf(line: string): string {
  return line.replace(/\*\*([^*]+)\*\*/g, (_, t) => `{\\b ${cyrToRtf(t)}}`);
}

export function downloadDocx(item: SynopsisItem) {
  const lines = item.text.split("\n");

  const rtfParts: string[] = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0\\froman Times New Roman;}}",
    "{\\colortbl;\\red0\\green0\\blue0;\\red40\\green70\\blue140;}",
    "\\widowctrl\\hyphauto",
    "\\margl1800\\margr1800\\margt1400\\margb1400",
  ];

  for (const line of lines) {
    if (line.trim() === "" || line === "---") {
      rtfParts.push("\\pard\\sb60\\par");
    } else if (line.startsWith("# ")) {
      rtfParts.push(`\\pard\\keepn\\sb300\\sa100\\f0\\fs34\\cf2\\b ${cyrToRtf(line.slice(2))}\\b0\\par`);
    } else if (line.startsWith("## ")) {
      rtfParts.push(`\\pard\\keepn\\sb240\\sa80\\f0\\fs28\\cf2\\b ${cyrToRtf(line.slice(3))}\\b0\\par`);
    } else if (line.startsWith("### ")) {
      rtfParts.push(`\\pard\\keepn\\sb200\\sa60\\f0\\fs26\\b ${cyrToRtf(line.slice(4))}\\b0\\par`);
    } else if (line.startsWith("#### ")) {
      rtfParts.push(`\\pard\\keepn\\sb160\\sa40\\f0\\fs24\\b ${cyrToRtf(line.slice(5))}\\b0\\par`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      rtfParts.push(`\\pard\\li360\\fi-200\\sb40\\f0\\fs22 \\bullet  ${mdLineToRtf(line.slice(2))}\\par`);
    } else if (/^\d+[.)]\s/.test(line)) {
      const m = line.match(/^(\d+[.)]\s?)(.*)$/);
      if (m) rtfParts.push(`\\pard\\li400\\fi-280\\sb40\\f0\\fs22 ${cyrToRtf(m[1])} ${mdLineToRtf(m[2])}\\par`);
    } else {
      rtfParts.push(`\\pard\\sb60\\sa60\\f0\\fs22 ${mdLineToRtf(line)}\\par`);
    }
  }

  rtfParts.push("}");
  const rtf = rtfParts.join("\n");

  const blob = new Blob([rtf], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeTopic = item.topic.replace(/[^a-zA-Z0-9\u0400-\u04FF ]/g, "").trim().slice(0, 40) || "конспект";
  a.href = url;
  a.download = `Конспект_${safeTopic}_${item.classNum}кл.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatWordCount(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 19) return `${n} слов`;
  const r = n % 10;
  if (r === 1) return `${n} слово`;
  if (r >= 2 && r <= 4) return `${n} слова`;
  return `${n} слов`;
}
