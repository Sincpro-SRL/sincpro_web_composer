import { Destination, type ResourceRef, type WorkspaceApi } from "@sincpro/web-composer";
import { Search, SquareArrowOutUpRight } from "lucide-react";
import { useId, useState } from "react";

import { includes } from "./datos";

/**
 * A relation field, the way an ERP draws it. Three gestures, three destinations, one API:
 *
 *   type      what matches is proposed; picking fills the field
 *   «open»    the chosen record in a WINDOW (⇧ click: beside the form), without leaving the form
 *   «search»  a list in a window that ANSWERS the field — `api.pick` and `api.answer`
 */
export function Many2One({
  api,
  label,
  value,
  options,
  recordOf,
  chooserOf,
  onChange,
}: {
  api: WorkspaceApi;
  label: string;
  value: string | null;
  options: readonly { id: string; nombre: string }[];
  recordOf: (id: string) => ResourceRef;
  chooserOf: ResourceRef;
  onChange: (id: string) => void;
}) {
  const list = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.id === value);
  const shown = options.filter((o) => includes(o.nombre, text));

  return (
    <div className="relative flex items-center gap-1">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={list}
        value={open ? text : (chosen?.nombre ?? "")}
        placeholder="Elegir…"
        onFocus={() => {
          setText("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => setText(e.target.value)}
        className="h-(--size-control-md) min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 text-meta text-ink"
      />
      <button
        type="button"
        aria-label={`Abrir ${label}`}
        disabled={chosen === undefined}
        onClick={(e) =>
          chosen === undefined
            ? undefined
            : api.open(recordOf(chosen.id), {
                to: e.shiftKey ? Destination.Side : Destination.Window,
              })
        }
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-ink/8 disabled:opacity-40"
      >
        <SquareArrowOutUpRight className="size-(--size-icon-sm)" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Buscar ${label}`}
        onClick={() => api.pick(chooserOf, (ref) => onChange(ref.id ?? ""))}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-ink/8"
      >
        <Search className="size-(--size-icon-sm)" aria-hidden />
      </button>

      {open ? (
        <ul
          id={list}
          role="listbox"
          className="absolute top-full left-0 z-10 mt-1 w-full rounded-control border border-line-strong bg-surface p-1 shadow-window"
        >
          {shown.map((o) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="cursor-pointer rounded-control px-2 py-1 text-meta text-ink hover:bg-primary/8"
            >
              {o.nombre}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
