import { createMemo } from "solid-js";
import { FiShuffle } from "solid-icons/fi";
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
  let touchStartX = 0;
  let touchStartY = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerStartTime = 0;
  let didSwipe = false;

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
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      props.onPrev?.();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      props.onNext?.();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    props.onFlip();
  };

  const handleControlClick = (event: MouseEvent, action?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  };

  const navigateBySwipe = (deltaX: number, deltaY: number) => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 56 || absX < absY * 1.25) return false;

    if (deltaX > 0) {
      props.onPrev?.();
    } else {
      props.onNext?.();
    }

    return true;
  };

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    didSwipe = navigateBySwipe(touch.clientX - touchStartX, touch.clientY - touchStartY);
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerStartTime = Date.now();
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType === "touch" || !pointerStartTime) return;

    const elapsed = Date.now() - pointerStartTime;
    pointerStartTime = 0;
    if (elapsed > 800) return;

    didSwipe = navigateBySwipe(event.clientX - pointerStartX, event.clientY - pointerStartY);
  };

  const handleCardClick = () => {
    if (didSwipe) {
      didSwipe = false;
      return;
    }

    props.onFlip();
  };

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
    <div class="flex min-h-7 items-center gap-2 border-b academic-rule pb-2">
      <span class="flex min-w-0 items-center gap-2 text-xs text-base-content/60">
        {typeIcon() && (
          <span
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-base-300 bg-base-100 text-base"
            title={props.type}
            aria-label={`Tipologia: ${props.type}`}
          >
            {typeIcon()}
          </span>
        )}
        <span class="font-normal text-base-content/50">{hint}</span>
      </span>
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      class="relative block h-[22rem] w-full cursor-pointer touch-pan-y select-none md:h-[26rem]"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-label="Capovolgi flashcard"
    >
      <div class="academic-surface relative h-full w-full rounded border">
        <div
          class={`absolute inset-0 flex h-full flex-col rounded p-3 text-left transition-opacity duration-150 md:p-4 ${
            props.isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {cardHeader("tocca: risposta · swipe: cambia")}
          <div class="mt-4 min-h-0 flex-1 overflow-auto px-0 md:px-1">
            <p class="text-xl font-semibold leading-relaxed md:text-2xl">{props.front}</p>
          </div>
          <div class="mt-2 flex justify-end">{shuffleControl()}</div>
        </div>

        <div
          class={`absolute inset-0 flex h-full flex-col rounded p-3 text-left transition-opacity duration-150 md:p-4 ${
            props.isFlipped ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {cardHeader("tocca: domanda · swipe: cambia")}
          <div class="mt-4 min-h-0 flex-1 overflow-auto px-0 md:px-1">
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
