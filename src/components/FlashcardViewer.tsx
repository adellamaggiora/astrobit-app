import { createMemo } from "solid-js";
import { FiChevronLeft, FiChevronRight, FiShuffle } from "solid-icons/fi";
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

  normalized = normalized.replace(/<!--[\s\S]*?-->/g, "");

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
  type?: string;
  isFlipped: boolean;
  onFlip: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  canShuffle?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onShuffle?: () => void;
  onOpenFlashcard?: (id: string) => void;
}) {
  configureMarked();

  const typeIcon = createMemo(() => {
    const type = props.type || "";
    const matches = type.match(/\p{Extended_Pictographic}/gu) || [];
    const icon = matches.join("");
    if (icon) return icon;

    if (/definizione/i.test(type)) return "\u{1F4A1}";
    if (/metodo/i.test(type)) return "\u{1F9E9}";
    if (/teoria/i.test(type)) return "\u{1F4D8}";
    if (/concetto/i.test(type)) return "\u{1F9E0}";

    return "";
  });

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

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    props.onFlip();
  };

  const handleControlClick = (event: MouseEvent, action?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  };

  const headerControls = () => (
    <div class="ml-auto flex shrink-0 items-center gap-3">
      <button
        type="button"
        class="btn btn-xs btn-outline btn-square"
        disabled={!props.canGoPrev}
        onClick={(event) => handleControlClick(event, props.onPrev)}
        aria-label="Precedente"
        title="Precedente"
      >
        <FiChevronLeft class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn btn-xs btn-outline btn-square"
        disabled={!props.canGoNext}
        onClick={(event) => handleControlClick(event, props.onNext)}
        aria-label="Successiva"
        title="Successiva"
      >
        <FiChevronRight class="h-4 w-4" />
      </button>
    </div>
  );

  const shuffleControl = () => (
    <button
      type="button"
      class="btn btn-sm btn-outline shrink-0"
      disabled={!props.canShuffle}
      onClick={(event) => handleControlClick(event, props.onShuffle)}
      aria-label="Mescola mazzo"
      title="Mescola mazzo"
    >
      <FiShuffle class="h-4 w-4" />
      <span>Mescola</span>
    </button>
  );

  const cardHeader = (hint: string) => (
    <div class="flex min-h-7 items-center gap-2">
      <span class="flex min-w-0 items-center gap-2 text-xs text-base-content/60">
        {typeIcon() && (
          <span
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-base-300 bg-base-200 text-base shadow-sm"
            title={props.type}
            aria-label={`Tipologia: ${props.type}`}
          >
            {typeIcon()}
          </span>
        )}
        <span class="font-normal text-base-content/50">{hint}</span>
      </span>
      {headerControls()}
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      class="relative block h-[22rem] w-full cursor-pointer md:h-[26rem]"
      onClick={props.onFlip}
      onKeyDown={handleKeyDown}
      aria-label="Capovolgi flashcard"
    >
      <div class="relative h-full w-full rounded-2xl border border-base-300 bg-base-100 shadow-md">
        <div
          class={`absolute inset-0 flex h-full flex-col rounded-2xl p-3 text-left transition-opacity duration-150 md:p-4 ${
            props.isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {cardHeader("clicca per retro")}
          <div class="mt-2 min-h-0 flex-1 overflow-auto px-0 md:px-1">
            <p class="text-lg font-medium leading-relaxed">{props.front}</p>
          </div>
          <div class="mt-2 flex justify-end">{shuffleControl()}</div>
        </div>

        <div
          class={`absolute inset-0 flex h-full flex-col rounded-2xl p-3 text-left transition-opacity duration-150 md:p-4 ${
            props.isFlipped ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {cardHeader("clicca per fronte")}
          <div class="mt-2 min-h-0 flex-1 overflow-auto px-0 md:px-1">
            <article
              class="flashcard-markdown text-base leading-relaxed"
              onClick={handleMarkdownClick}
              innerHTML={backHtml()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
