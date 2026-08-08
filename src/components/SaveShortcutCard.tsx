import { useEffect, useState } from "react";
import { copyToClipboard } from "../services/accessApi";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Lets a client keep a permanent way back into their workspace:
 * copy the link, or add a home-screen / desktop shortcut.
 */
export function SaveShortcutCard({ label = "השמירה לגישה מהירה" }: { label?: string }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [installed, setInstalled] = useState(false);
  const link = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <section className="card shortcut-card" dir="rtl">
      <h2>{label}</h2>
      <p className="form-note">שמרו את הלינק לאזור האישי שלכם, או צרו קיצור דרך במסך הבית / שולחן העבודה כדי להיכנס בלחיצה אחת.</p>
      <input readOnly dir="ltr" value={link} onFocus={(event) => event.currentTarget.select()} />
      <div className="action-row">
        <button type="button" onClick={async () => { await copyToClipboard(link); setCopied(true); }}>
          {copied ? "הלינק הועתק" : "העתק לינק"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <button type="button" onClick={() => void (navigator as Navigator).share?.({ title: "האזור האישי שלי", url: link })}>
            שיתוף / שמירה
          </button>
        ) : null}
        {installEvent ? (
          <button type="button" className="primary-button" onClick={() => void install()}>
            הוסף קיצור דרך
          </button>
        ) : null}
      </div>
      {installed ? <p className="form-note">קיצור הדרך נוסף למכשיר.</p> : null}
      {!installEvent && !installed ? (
        <p className="form-note">
          {isIos
            ? "באייפון: לחצו על כפתור השיתוף בסרגל הדפדפן ואז על \u201cהוספה למסך הבית\u201d."
            : "בנייד: תפריט הדפדפן ← \u201cהוספה למסך הבית\u201d. במחשב: תפריט הדפדפן ← \u201cהתקנה\u201d או צרו סימנייה."}
        </p>
      ) : null}
    </section>
  );
}