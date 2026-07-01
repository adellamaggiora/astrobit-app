import { createMemo } from "solid-js";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";

let isMarkedConfigured = false;

const configureMarked = () => {
  if (isMarkedConfigured) return;

  marked.setOptions({
    gfm: true,
    breaks: true
  });

  marked.use(
    markedKatex({
      throwOnError: false,
      nonStandard: true,
      macros: {
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\R": "\\mathbb{R}",
        "\\C": "\\mathbb{C}"
      }
    })
  );

  isMarkedConfigured = true;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeUrl = (url?: string): string => {
  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return url;
  }
  return "#";
};

const toDashedId = (value: string): string | undefined => {
  const clean = value.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(clean)) return undefined;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(
    16,
    20
  )}-${clean.slice(20)}`;
};

export const extractNotionIdFromHref = (href: string): string | undefined => {
  if (!href) return undefined;
  const decoded = decodeURIComponent(href);
  const match = decoded.match(
    /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return match ? toDashedId(match[1]) : undefined;
};

const applyTextAnnotations = (text: string, richItem: any): string => {
  let value = escapeHtml(text);
  const annotations = richItem?.annotations;

  if (annotations?.code) value = `<code>${value}</code>`;
  if (annotations?.bold) value = `<strong>${value}</strong>`;
  if (annotations?.italic) value = `<em>${value}</em>`;
  if (annotations?.strikethrough) value = `<del>${value}</del>`;
  if (annotations?.underline) value = `<u>${value}</u>`;

  const linkUrl = sanitizeUrl(richItem?.text?.link?.url);
  if (richItem?.text?.link?.url) {
    value = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${value}</a>`;
  }

  return value;
};

const richTextToMarkdown = (richText: any[] = []): string =>
  richText
    .map((item) => {
      if (item?.type === "equation") {
        const expression = item?.equation?.expression?.trim();
        return expression ? `$${expression}$` : "";
      }

      const text = item?.plain_text ?? "";
      return applyTextAnnotations(text, item);
    })
    .join("");

const blockTitle = (payload: any): string =>
  payload?.title || payload?.caption?.map((item: any) => item?.plain_text).join("") || "";

const blocksToMarkdown = (blocks: any[] = []): string => {
  const output: string[] = [];

  for (const block of blocks) {
    const type = block?.type;
    const payload = type ? block?.[type] : undefined;
    const text = richTextToMarkdown(payload?.rich_text);
    const trimmedText = text.trim();

    if (type === "heading_1") {
      output.push(trimmedText ? `# ${trimmedText}` : "#");
      continue;
    }

    if (type === "heading_2") {
      output.push(trimmedText ? `## ${trimmedText}` : "##");
      continue;
    }

    if (type === "heading_3") {
      output.push(trimmedText ? `### ${trimmedText}` : "###");
      continue;
    }

    if (type === "bulleted_list_item") {
      output.push(`- ${trimmedText}`);
      continue;
    }

    if (type === "numbered_list_item") {
      output.push(`1. ${trimmedText}`);
      continue;
    }

    if (type === "to_do") {
      output.push(`- [${payload?.checked ? "x" : " "}] ${trimmedText}`);
      continue;
    }

    if (type === "quote") {
      output.push(trimmedText ? `> ${trimmedText}` : ">");
      continue;
    }

    if (type === "callout") {
      output.push(trimmedText);
      continue;
    }

    if (type === "equation") {
      const expression = payload?.expression?.trim();
      output.push(expression ? `$$\n${expression}\n$$` : "");
      continue;
    }

    if (type === "code") {
      const language = payload?.language || "";
      output.push(`\`\`\`${language}\n${trimmedText}\n\`\`\``);
      continue;
    }

    if (type === "divider") {
      output.push("---");
      continue;
    }

    if (type === "paragraph") {
      output.push(text);
      continue;
    }

    if (type === "child_database") {
      const title = blockTitle(payload);
      output.push(title ? `## ${escapeHtml(title)}` : "## Vista");
      continue;
    }

    if (type === "child_page") {
      const title = blockTitle(payload);
      output.push(title ? `- ${escapeHtml(title)}` : "- Pagina");
      continue;
    }

    if (type === "bookmark" || type === "link_preview" || type === "embed") {
      const url = sanitizeUrl(payload?.url);
      output.push(url !== "#" ? `[${escapeHtml(payload?.url || "Link")}](${url})` : "");
      continue;
    }

    output.push(trimmedText);
  }

  return output.join("\n\n");
};

const normalizeMarkdown = (input: string): string => {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let inCallout = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("::: callout")) {
      inCallout = true;
      continue;
    }

    if (inCallout && trimmed === ":::") {
      inCallout = false;
      output.push("");
      continue;
    }

    if (trimmed === "<empty-block/>") {
      output.push("");
      continue;
    }

    const sanitized = line.replace(/<\/?span[^>]*>/gi, "");

    if (inCallout) {
      output.push(sanitized.trim());
      continue;
    }

    output.push(sanitized);
  }

  let normalized = output.join("\n");

  normalized = normalized.replace(/<!--[\s\S]*?-->/g, "");
  normalized = normalized.replace(/\$`([\s\S]*?)`\$/g, (_match, formula: string) => {
    return `$${formula.trim()}$`;
  });
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => {
    return `$${formula.trim()}$`;
  });
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => {
    return `$$\n${formula.trim()}\n$$`;
  });
  normalized = normalized.replace(/\\([*_~`$[\]()])/g, "$1");
  normalized = normalized.replace(/\t/g, "  ");

  return normalized.trim();
};

export default function NotionMarkdown(props: {
  content: string | any[];
  class?: string;
  onOpenNotionPage?: (id: string) => void;
}) {
  configureMarked();

  const html = createMemo(() => {
    const markdown = typeof props.content === "string" ? props.content : blocksToMarkdown(props.content || []);
    return marked.parse(normalizeMarkdown(markdown), { async: false });
  });

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (!anchor) return;

    event.stopPropagation();

    const pageId = extractNotionIdFromHref(anchor.getAttribute("href") || "");
    if (!pageId || !props.onOpenNotionPage) return;

    event.preventDefault();
    props.onOpenNotionPage(pageId);
  };

  return (
    <article
      class={`notion-markdown ${props.class || ""}`}
      onClick={handleClick}
      innerHTML={html()}
    />
  );
}
