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

const extractFlashcardIdFromHref = (href: string): string | undefined => {
  if (!href) return undefined;
  const decoded = decodeURIComponent(href);
  const match = decoded.match(
    /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
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

const notionBlocksToMarkdown = (blocks: any[] = []): string => {
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

    output.push(trimmedText);
  }

  return output.join("\n\n");
};

const normalizeBackMarkdown = (input: string): string => {
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

    let sanitized = line.replace(/<\/?span[^>]*>/gi, "");

    if (inCallout) {
      output.push(sanitized.trim());
      continue;
    }

    output.push(sanitized);
  }

  let normalized = output.join("\n");

  // Notion sometimes wraps inline math inside backticks: $`...`$.
  normalized = normalized.replace(/\$`([\s\S]*?)`\$/g, (_match, formula: string) => {
    return `$${formula.trim()}$`;
  });

  // Convert escaped LaTeX delimiters from Notion markdown into $...$ / $$...$$.
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => {
    return `$${formula.trim()}$`;
  });
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => {
    return `$$\n${formula.trim()}\n$$`;
  });

  // Unescape markdown formatting markers that sometimes come escaped by export.
  normalized = normalized.replace(/\\([*_~`$[\]()])/g, "$1");
  normalized = normalized.replace(/\t/g, "  ");

  return normalized.trim();
};

export default function FlashcardViewer(props: {
  front: string;
  back: string | any[];
  isFlipped: boolean;
  onFlip: () => void;
  onOpenFlashcard?: (id: string) => void;
}) {
  configureMarked();

  const backHtml = createMemo(() => {
    const backAsMarkdown =
      typeof props.back === "string" ? props.back : notionBlocksToMarkdown(props.back || []);

    const normalized = normalizeBackMarkdown(backAsMarkdown);
    return marked.parse(normalized, { async: false });
  });

  const handleMarkdownClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a");
    if (!anchor) return;

    // Avoid flipping the whole card when user clicks a link in the markdown content.
    event.stopPropagation();

    const href = anchor.getAttribute("href") || "";
    const flashcardId = extractFlashcardIdFromHref(href);
    if (!flashcardId || !props.onOpenFlashcard) return;

    event.preventDefault();
    props.onOpenFlashcard(flashcardId);
  };

  return (
    <button
      type="button"
      class="relative block h-72 w-full md:h-80"
      onClick={props.onFlip}
      aria-label="Capovolgi flashcard"
    >
      <div class="relative h-full w-full rounded-2xl border border-base-300 bg-base-100 shadow-md">
        <div
          class={`absolute inset-0 flex h-full flex-col overflow-auto rounded-2xl p-6 text-left transition-opacity duration-150 ${
            props.isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/60">
            Fronte
            <span class="ml-2 font-normal normal-case tracking-normal text-base-content/50">
              clicca per retro
            </span>
          </span>
          <p class="mt-3 text-lg font-medium leading-relaxed">{props.front}</p>
        </div>

        <div
          class={`absolute inset-0 flex h-full flex-col overflow-auto rounded-2xl p-6 text-left transition-opacity duration-150 ${
            props.isFlipped ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span class="text-xs font-semibold uppercase tracking-wider text-base-content/60">
            Retro
            <span class="ml-2 font-normal normal-case tracking-normal text-base-content/50">
              clicca per fronte
            </span>
          </span>
          <article
            class="flashcard-markdown mt-3 text-base leading-relaxed"
            onClick={handleMarkdownClick}
            innerHTML={backHtml()}
          />
        </div>
      </div>
    </button>
  );
}
