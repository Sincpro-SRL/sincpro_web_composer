/**
 * Every word the composer draws, in one table. English by
 * default; an application installs its language ONCE with `installComposerCopy`, next to the
 * design system's `installCopy`, and no component carries a hard-coded string.
 */

export type ComposerCopy = {
  panel: {
    more: string;
    moveTo: string;
    left: string;
    leftHint: string;
    right: string;
    rightHint: string;
    bottom: string;
    bottomHint: string;
    window: string;
    windowHint: string;
    expand: string;
    minimize: string;
    restore: string;
    enlarge: string;
    close: string;
    resizeZone: (zone: string) => string;
    resizeBetween: string;
    dropLeft: string;
    dropRight: string;
    dropBottom: string;
  };
  peek: {
    openAsPage: string;
    openAsPanel: string;
    close: string;
    back: (to: string) => string;
  };
  modal: { close: string };
  phone: { alsoOpen: string };
  discard: {
    title: string;
    detail: (names: readonly string[]) => string;
    keep: string;
    discard: string;
  };
  link: { peek: string; side: string; window: string };
  view: { failed: string; unresolved: string; loading: (domain: string) => string };
  palette: {
    label: string;
    placeholder: string;
    sections: { actions: string; goto: string; found: string };
    empty: string;
    searching: string;
    hint: string;
  };
  shortcuts: readonly { keys: string; action: string }[];
};

export const ENGLISH_COMPOSER_COPY: ComposerCopy = {
  panel: {
    more: "More",
    moveTo: "move to",
    left: "To the left",
    leftHint: "docked to the left edge",
    right: "To the right",
    rightHint: "docked to the right edge",
    bottom: "To the bottom",
    bottomHint: "docked to the foot",
    window: "Window",
    windowHint: "floating; drag it by the title",
    expand: "Expand to a page",
    minimize: "Minimize",
    restore: "Restore",
    enlarge: "Enlarge",
    close: "Close",
    resizeZone: (zone) => `Resize the ${zone} zone`,
    resizeBetween: "Resize between two panels",
    dropLeft: "to the left",
    dropRight: "to the right",
    dropBottom: "to the bottom",
  },
  peek: {
    openAsPage: "Open as page",
    openAsPanel: "Open as panel",
    close: "Close the preview",
    back: (to) => `Back to ${to}`,
  },
  modal: { close: "Close" },
  phone: { alsoOpen: "Also open" },
  discard: {
    title: "Discard the changes?",
    detail: (names) => `What was typed in ${names.join(", ")} has not been saved.`,
    keep: "Keep editing",
    discard: "Discard",
  },
  link: { peek: "Peek", side: "Open beside", window: "Open in a window" },
  view: {
    failed: "This view failed to render",
    unresolved: "Nobody can resolve this reference",
    loading: (domain) => `loading ${domain}…`,
  },
  palette: {
    label: "Command palette",
    placeholder: "Go to, search, or act on what you are on…",
    sections: { actions: "Do", goto: "Go to", found: "Found" },
    empty: "Nothing matches",
    searching: "searching…",
    hint: "↵ page · ⌥↵ peek · ⇧↵ beside · ⌘↵ window · esc close",
  },
  shortcuts: [
    { keys: "⌘K", action: "go to, search, or act on what you are on" },
    { keys: "⌥←", action: "one page back, or one step back in the peek" },
    { keys: "⌘⌥[ / ⌘⌥]", action: "move focus between the page and the panels" },
    { keys: "⌘⇧⏎", action: "maximize the focused surface, or restore it" },
    { keys: "⌘⇧⌫", action: "close the focused panel, modal or the peek" },
    { keys: "Esc", action: "close the modal or the peek, or restore the maximized view" },
    { keys: "← → on a handle", action: "resize without the mouse" },
  ],
};

export const SPANISH_COMPOSER_COPY: ComposerCopy = {
  panel: {
    more: "Más",
    moveTo: "mover a",
    left: "A la izquierda",
    leftHint: "acoplado al borde izquierdo",
    right: "A la derecha",
    rightHint: "acoplado al borde derecho",
    bottom: "Abajo",
    bottomHint: "acoplado al pie",
    window: "Ventana",
    windowHint: "flotante; se arrastra por el título",
    expand: "Agrandar a página",
    minimize: "Minimizar",
    restore: "Restaurar",
    enlarge: "Maximizar",
    close: "Cerrar",
    resizeZone: (zone) =>
      `Redimensionar la zona ${{ left: "izquierda", right: "derecha", bottom: "inferior" }[zone] ?? zone}`,
    resizeBetween: "Redimensionar entre dos paneles",
    dropLeft: "a la izquierda",
    dropRight: "a la derecha",
    dropBottom: "abajo",
  },
  peek: {
    openAsPage: "Abrir como página",
    openAsPanel: "Abrir como panel",
    close: "Cerrar la vista previa",
    back: (to) => `Volver a ${to}`,
  },
  modal: { close: "Cerrar" },
  phone: { alsoOpen: "También abiertos" },
  discard: {
    title: "¿Descartar los cambios?",
    detail: (names) => `Lo escrito en ${names.join(", ")} no se guardó.`,
    keep: "Seguir editando",
    discard: "Descartar",
  },
  link: { peek: "Vistazo", side: "Abrir al lado", window: "Abrir en una ventana" },
  view: {
    failed: "Esta vista no se pudo dibujar",
    unresolved: "Nadie sabe resolver esta referencia",
    loading: (domain) => `cargando ${domain}…`,
  },
  palette: {
    label: "Paleta de comandos",
    placeholder: "Ir a, buscar o actuar sobre lo que miras…",
    sections: { actions: "Hacer", goto: "Ir a", found: "Encontrado" },
    empty: "Nada coincide",
    searching: "buscando…",
    hint: "↵ página · ⌥↵ vistazo · ⇧↵ al lado · ⌘↵ ventana · esc cerrar",
  },
  shortcuts: [
    { keys: "⌘K", action: "ir a, buscar o actuar sobre lo que miras" },
    { keys: "⌥←", action: "una página atrás, o un paso atrás en el vistazo" },
    { keys: "⌘⌥[ / ⌘⌥]", action: "mover el foco entre la página y los paneles" },
    { keys: "⌘⇧⏎", action: "maximizar la superficie con foco, o restaurarla" },
    { keys: "⌘⇧⌫", action: "cerrar el panel o el modal con foco, o el vistazo" },
    { keys: "Esc", action: "cerrar el modal o el vistazo, o restaurar la vista maximizada" },
    { keys: "← → en un divisor", action: "redimensionar sin el mouse" },
  ],
};

let installed: ComposerCopy = ENGLISH_COMPOSER_COPY;

/** Install the composer's words once, where the application starts. */
export function installComposerCopy(copy: ComposerCopy): void {
  installed = copy;
}

/** The words in use. A plain read: they are installed before anything draws. */
export const composerCopy = (): ComposerCopy => installed;
