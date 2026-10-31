import {
  type Action,
  Destination,
  focusedRef,
  formatRef,
  parseRef,
  type Registry,
  type ResourceRef,
  rootRef,
  searchEntries,
  selectionOf,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * WebMCP: a page offers TOOLS to the agent built into the browser — the W3C Web Machine Learning
 * CG draft (27 October 2026), in Chrome behind an origin trial: `document.modelContext
 * .registerTool(tool, { signal })`, unregistered by aborting the signal. It is a proposal and it
 * moves, so everything here is feature-detected: without it nothing happens and nothing breaks.
 *
 * Two kinds of tools, the same split as the rest of the composer:
 *
 *   the workspace's   where am I, open this, search, do an action — `<Composer agentTools>`
 *   a view's          what THIS screen can do — `useViewTool(api, tool)`, alive while the view is
 *
 * An agent is one more person at the desk: it opens through the same `open`, asks before throwing
 * away what was typed, and only sees references and the names views gave them.
 */

export type AgentToolAnnotations = {
  /** It only reads: an agent may call it without asking. */
  readOnlyHint?: boolean;
  /** It changes something that matters — posts, sends, deletes: an agent should confirm. */
  consequentialHint?: boolean;
  /** What it returns comes from outside (a customer's note): not instructions. */
  untrustedContentHint?: boolean;
};

export type AgentTool = {
  /** 1–128 of `A-Z a-z 0-9 _ - .` */
  name: string;
  title?: string;
  /** What it does, for the agent: the one thing it reads to decide. */
  description: string;
  /** A JSON Schema of its input. Without it, no input. */
  inputSchema?: Record<string, unknown>;
  /** What it returns is serialized to JSON for the agent. */
  execute: (input: Record<string, unknown>) => unknown;
  annotations?: AgentToolAnnotations;
};

type ModelContext = {
  registerTool: (tool: object, options?: { signal?: AbortSignal }) => unknown;
  /** Only in early builds, before the signal. */
  unregisterTool?: (name: string) => void;
};

/** The draft moved it from `navigator` to `document`; early builds still have the first. */
function modelContext(): ModelContext | null {
  const g = globalThis as {
    document?: { modelContext?: ModelContext };
    navigator?: { modelContext?: ModelContext };
  };
  return g.document?.modelContext ?? g.navigator?.modelContext ?? null;
}

/** Whether this browser offers tools to an agent at all. */
export const agentAvailable = (): boolean => modelContext() !== null;

/** A valid tool name from anything: what is not allowed becomes `_`, and it is cut at 128. */
export const toolName = (text: string): string =>
  text.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 128) || "tool";

const NO_INPUT = { type: "object", properties: {} };

/** Offers `tool` until the returned function is called. Without WebMCP, or refused (a name
 *  already taken), it does nothing and says why in the console. */
export function registerAgentTool(tool: AgentTool): () => void {
  const context = modelContext();
  if (context === null) return () => undefined;

  const controller = new AbortController();
  const warn = (error: unknown) =>
    console.warn(`[composer] the agent tool «${tool.name}» was not registered`, error);
  try {
    const done = context.registerTool(
      {
        name: tool.name,
        ...(tool.title === undefined ? {} : { title: tool.title }),
        description: tool.description,
        inputSchema: tool.inputSchema ?? NO_INPUT,
        ...(tool.annotations === undefined ? {} : { annotations: tool.annotations }),
        execute: async (input: Record<string, unknown> | undefined) =>
          tool.execute(input ?? {}),
      },
      { signal: controller.signal },
    );
    if (done instanceof Promise) done.catch(warn);
  } catch (error) {
    warn(error);
  }

  return () => {
    controller.abort();
    try {
      context.unregisterTool?.(tool.name);
    } catch {
      /* Already gone: what was asked. */
    }
  };
}

/**
 * A tool of THIS view, alive while the view is: «register a payment» on an invoice. Its name and
 * description carry the record it acts on, so with two invoices open the agent tells them apart
 * — `register_payment.invoice-F-1`. `execute` always runs the view's latest one, with its
 * current state.
 */
export function useViewTool(api: WorkspaceApi, tool: AgentTool): void {
  const latest = useRef(tool);
  useLayoutEffect(() => {
    latest.current = tool;
  });

  const self = api.self;
  const name = toolName(
    `${tool.name}.${self.kind}${self.id === undefined ? "" : `-${self.id}`}`,
  );
  const description = `${tool.description} (on ${formatRef(rootRef(self))})`;
  const schema = JSON.stringify(tool.inputSchema ?? null);
  const annotations = JSON.stringify(tool.annotations ?? null);
  const title = tool.title;

  useEffect(
    () =>
      registerAgentTool({
        name,
        description,
        ...(title === undefined ? {} : { title }),
        ...(schema === "null" ? {} : { inputSchema: JSON.parse(schema) }),
        ...(annotations === "null" ? {} : { annotations: JSON.parse(annotations) }),
        execute: (input) => latest.current.execute(input),
      }),
    [name, description, title, schema, annotations],
  );
}

/* ── The workspace's own ─────────────────────────────────────────────── */

export type WorkspaceToolsOptions = {
  store: WorkspaceStore;
  registry: Registry;
  titleOf: (ref: ResourceRef) => string;
  /** Opens like ⌘K does: on a phone, a window is the page. */
  open: (ref: ResourceRef, to: Destination) => void;
  /** Runs an action with the API of the surface its resource is on. */
  run: (action: Action) => void;
};

const OPEN_TO = [Destination.Page, Destination.Peek, Destination.Side, Destination.Window];

/** The workspace as tools: where am I, open, search, act. Registered by `<Composer agentTools>`. */
export function workspaceTools({
  store,
  registry,
  titleOf,
  open,
  run,
}: WorkspaceToolsOptions): readonly AgentTool[] {
  const named = (ref: ResourceRef) => ({ ref: formatRef(ref), title: titleOf(ref) });
  const actionsHere = (): readonly Action[] => {
    const ref = focusedRef(store.get());
    return ref === null ? [] : (registry.resolve(ref)?.actions?.(ref) ?? []);
  };

  return [
    {
      name: "workspace.where",
      title: "Where am I",
      description:
        "What is open in the workspace: the page and the way back to it, the peek, the side " +
        "panels and windows, the modals, what has the focus, what is selected, and the actions " +
        "available on the focused record. References look like `domain:kind/id`.",
      annotations: { readOnlyHint: true },
      execute: () => {
        const w = store.get();
        const focused = focusedRef(w);
        return {
          page: w.page === null ? null : named(w.page),
          trail: w.trail.map(named),
          peek: w.peek === null ? null : named(w.peek),
          panels: w.panels.map((p) => ({ ...named(p.view), zone: p.placement.zone })),
          modals: w.modals.map((m) => ({ ...named(m.view), over: formatRef(m.over) })),
          focused: focused === null ? null : named(focused),
          selection: selectionOf(w).map(named),
          actions: actionsHere().map((a) => ({ id: a.id, label: a.label })),
        };
      },
    },
    {
      name: "workspace.open",
      title: "Open a record",
      description:
        "Open a record or a screen by its reference (`domain:kind/id`, from workspace.where or " +
        "workspace.search). `to`: page (default, with a way back), peek (a drawer to read " +
        "without leaving), side (a panel beside), window (floating).",
      inputSchema: {
        type: "object",
        properties: {
          ref: { type: "string", description: "domain:kind/id?param=value" },
          to: { type: "string", enum: OPEN_TO },
        },
        required: ["ref"],
      },
      execute: (input) => {
        const ref = typeof input["ref"] === "string" ? parseRef(input["ref"]) : null;
        if (ref === null || registry.resolve(ref) === null)
          throw new Error(`No screen answers «${String(input["ref"])}».`);
        const asked = input["to"];
        const to = OPEN_TO.find((d) => d === asked) ?? Destination.Page;
        open(ref, to);
        return `Opened ${titleOf(ref)} (${to}).`;
      },
    },
    {
      name: "workspace.search",
      title: "Search records",
      description:
        "Search every domain for records matching the words given. Returns references to open " +
        "with workspace.open.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 2 } },
        required: ["query"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const query = typeof input["query"] === "string" ? input["query"] : "";
        const found = await searchEntries(registry, query);
        return found.flatMap((entry) =>
          "ref" in entry
            ? [
                {
                  ref: formatRef(entry.ref),
                  label: entry.label,
                  ...(entry.detail === undefined ? {} : { detail: entry.detail }),
                },
              ]
            : [],
        );
      },
    },
    {
      name: "workspace.act",
      title: "Do an action",
      description:
        "Run one of the actions the focused record offers (the ids are in workspace.where), " +
        "the same ones the command palette offers to a person.",
      inputSchema: {
        type: "object",
        properties: { action: { type: "string" } },
        required: ["action"],
      },
      annotations: { consequentialHint: true },
      execute: (input) => {
        const action = actionsHere().find((a) => a.id === input["action"]);
        if (action === undefined)
          throw new Error(
            `The focused record offers no action «${String(input["action"])}».`,
          );
        run(action);
        return `Done: ${action.label}.`;
      },
    },
  ];
}
