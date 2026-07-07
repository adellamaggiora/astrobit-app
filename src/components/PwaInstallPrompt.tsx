import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { FiDownload, FiSmartphone, FiX } from "solid-icons/fi";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandalone = () => {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = createSignal<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = createSignal(false);
  const [isInstalled, setIsInstalled] = createSignal(isStandalone());

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled()) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    onCleanup(() => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    });
  });

  const install = async () => {
    const event = installEvent();
    if (!event) return;

    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setInstallEvent(null);
      setIsVisible(false);
    }
  };

  return (
    <Show when={isVisible() && !!installEvent() && !isInstalled()}>
      <div class="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4">
        <div class="academic-surface mx-auto flex max-w-3xl items-start gap-3 rounded border p-3">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-primary/30 bg-base-100 text-primary">
            <FiSmartphone class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">Installa Astrobit come PWA</p>
            <p class="text-xs leading-relaxed text-base-content/70">
              Il browser ha riconosciuto Astrobit come app installabile. Il pulsante apre il
              prompt nativo PWA e l'app partirà in modalità standalone, non come semplice
              collegamento a una pagina.
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                class="btn btn-primary btn-sm gap-2"
                onClick={install}
                title="Installa PWA"
              >
                <FiDownload class="h-4 w-4" />
                <span>Installa PWA</span>
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => setIsVisible(false)}
              >
                Dopo
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square shrink-0"
            onClick={() => setIsVisible(false)}
            aria-label="Chiudi messaggio installazione"
            title="Chiudi"
          >
            <FiX class="h-4 w-4" />
          </button>
        </div>
      </div>
    </Show>
  );
}
