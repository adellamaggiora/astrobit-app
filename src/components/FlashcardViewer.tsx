import { createMemo } from "solid-js";
import { FiChevronLeft, FiChevronRight, FiShuffle } from "solid-icons/fi";
import NotionMarkdown from "./NotionMarkdown";

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
            <NotionMarkdown
              content={props.back || ""}
              class="text-base leading-relaxed"
              onOpenNotionPage={props.onOpenFlashcard}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
