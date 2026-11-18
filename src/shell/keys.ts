/**
 * A shortcut is written once and drawn as the keyboard in use prints it. Either notation: a
 * Mac's glyphs (⌘K, ⌥↵, ⌘⇧⏎ — the composer's own copy) or the web's words (Mod+K, Alt+↵, where
 * Mod is ⌘ on a Mac and Ctrl elsewhere). The workspace already takes Ctrl for ⌘; a hint that
 * names a key the keyboard does not have tells a Windows user nothing.
 */

const OFF_APPLE: Readonly<Record<string, string>> = {
  "⌘": "Ctrl+",
  "⌃": "Ctrl+",
  "⌥": "Alt+",
  "⇧": "Shift+",
};

const ON_APPLE: Readonly<Record<string, string>> = {
  mod: "⌘",
  cmd: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
};

/** Without a browser (a test, the server) it reads as a Mac: the copy's own notation. */
function onApple(): boolean {
  if (typeof navigator === "undefined") return true;
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(agent.userAgentData?.platform ?? navigator.platform);
}

/** `text` with its shortcuts named for this keyboard. Off a Mac «⌘⇧⏎» and «Mod+Shift+⏎» read
 *  «Ctrl+Shift+⏎»; on one, both read «⌘⇧⏎». For an app that draws shortcuts itself:
 *  `composerCopy().shortcuts`, its own actions. */
export function platformKeys(text: string, apple: boolean = onApple()): string {
  if (apple) {
    return text.replace(
      /\b(mod|cmd|ctrl|alt|option|shift)\+/gi,
      (word, key: string) => ON_APPLE[key.toLowerCase()] ?? word,
    );
  }
  return text
    .replace(/[⌘⌃⌥⇧]/g, (key) => OFF_APPLE[key] ?? key)
    .replace(/\b(mod|cmd)\+/gi, "Ctrl+")
    .replace(/\boption\+/gi, "Alt+");
}
