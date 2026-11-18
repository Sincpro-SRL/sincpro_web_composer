/**
 * The copy writes shortcuts the way a Mac keyboard reads them — ⌘K, ⌥↵, ⌘⇧⏎ — and the workspace
 * already takes Ctrl for ⌘. Off a Mac the keys are named as that keyboard prints them, or the
 * hint tells a Windows user to press a key they do not have.
 */

const OFF_APPLE: Readonly<Record<string, string>> = {
  "⌘": "Ctrl+",
  "⌃": "Ctrl+",
  "⌥": "Alt+",
  "⇧": "Shift+",
};

/** Without a browser (a test, the server) the copy's own notation stands. */
function onApple(): boolean {
  if (typeof navigator === "undefined") return true;
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(agent.userAgentData?.platform ?? navigator.platform);
}

/** `text` with its shortcuts named for this keyboard: «⌘⇧⏎» reads «Ctrl+Shift+⏎» off a Mac.
 *  For an app that draws `composerCopy().shortcuts` or its actions' shortcuts itself. */
export function platformKeys(text: string, apple: boolean = onApple()): string {
  return apple ? text : text.replace(/[⌘⌃⌥⇧]/g, (key) => OFF_APPLE[key] ?? key);
}
