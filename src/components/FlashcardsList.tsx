import { For, Show, createEffect, onCleanup } from "solid-js";

export type FlashcardsListItem = {
  id: string;
  title: string;
};

export default function FlashcardsList(props: {
  items: FlashcardsListItem[];
  selectedId?: string;
  hasMore: boolean;
  isLoadingInitial?: boolean;
  isLoadingMore?: boolean;
  scrollToTopTrigger?: number;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
}) {
  let scrollRef: HTMLDivElement | undefined;
  let sentinelRef: HTMLDivElement | undefined;

  createEffect(() => {
    const root = scrollRef;
    const sentinel = sentinelRef;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!isVisible) return;
        if (!props.hasMore || props.isLoadingMore) return;
        props.onLoadMore();
      },
      {
        root,
        rootMargin: "160px 0px"
      }
    );

    observer.observe(sentinel);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    props.scrollToTopTrigger;
    if (!scrollRef) return;
    scrollRef.scrollTop = 0;
  });

  return (
    <div class="academic-surface rounded border">
      <div ref={scrollRef} class="max-h-[42vh] min-h-[240px] overflow-auto p-2">
        <Show
          when={props.items.length > 0}
          fallback={
            <div class="rounded-lg border border-dashed border-base-300 bg-base-200/30 p-3 text-sm text-base-content/70">
              {props.isLoadingInitial ? "Caricamento elenco..." : "Nessuna flashcard trovata."}
            </div>
          }
        >
          <div class="overflow-hidden rounded border border-base-300 divide-y divide-base-300">
            <For each={props.items}>
              {(item, index) => (
                <button
                  type="button"
                  class={`w-full min-h-16 px-3 py-3 text-left text-sm transition-colors ${
                    props.selectedId === item.id
                      ? "bg-primary text-primary-content"
                      : "bg-base-100 hover:bg-base-200/60"
                  }`}
                  onClick={() => props.onSelect(item.id)}
                >
                  <span class="mr-2 text-xs opacity-70">{index() + 1}.</span>
                  <span>{item.title || "Senza titolo"}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div ref={sentinelRef} class="h-1" />

        <Show when={props.isLoadingMore}>
          <p class="px-1 py-2 text-xs text-base-content/60">Caricamento altre flashcards...</p>
        </Show>
      </div>
    </div>
  );
}
