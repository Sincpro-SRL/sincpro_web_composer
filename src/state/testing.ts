import {
  type Crumb,
  type ResourceRef,
  Surface,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";

/**
 * An `api` for testing a view WITHOUT a workspace: it does nothing, and remembers every call. A
 * view only talks to the workspace through its `api`, so what it asked for is what a test checks —
 * «opened the payment as a modal», «named itself Acme» — with no store, no shell and no browser.
 *
 *     const t = createTestApi(invoiceRef("F-1"));
 *     render(<Invoice resource={t.api.self} api={t.api} />);
 *     // … click «Register payment»
 *     expect(t.calls).toContainEqual({ method: "open", args: [paymentRef("F-1"), { to: "modal" }] });
 *
 * A chooser it was asked to open answers with `respond(value)`, the way its view would.
 */

/** One call the view made: the method and its arguments, as given. */
export type ApiCall = {
  [K in keyof WorkspaceApi]: WorkspaceApi[K] extends (...args: infer A) => unknown
    ? { method: K; args: A }
    : never;
}[keyof WorkspaceApi];

export type TestApiOptions = {
  surface?: Surface;
  /** What a modal was opened over (`api.over`). */
  over?: ResourceRef | null;
  /** What `useCrumbs(api)` / `api.crumbs()` give. */
  crumbs?: readonly Crumb[];
  /** What `api.context.selection()` gives. */
  selection?: readonly ResourceRef[];
};

export type TestApi = {
  api: WorkspaceApi;
  /** Every call, in order. */
  calls: ApiCall[];
  /** The calls to one method, typed: `t.callsTo("open")[0]`. */
  callsTo: <K extends ApiCall["method"]>(method: K) => Extract<ApiCall, { method: K }>[];
  /** Answers the last chooser opened with `pick`, as its view would. */
  respond: (value: unknown) => void;
};

const NO_CRUMBS: readonly Crumb[] = [];
const NO_REFS: readonly ResourceRef[] = [];

export function createTestApi(self: ResourceRef, options: TestApiOptions = {}): TestApi {
  const calls: ApiCall[] = [];
  const pending: ((value: unknown) => void)[] = [];
  const crumbs = options.crumbs ?? NO_CRUMBS;
  const selection = options.selection ?? NO_REFS;

  const record =
    <K extends ApiCall["method"]>(method: K) =>
    (...args: Extract<ApiCall, { method: K }>["args"]) => {
      calls.push({ method, args } as ApiCall);
    };

  const api: WorkspaceApi = {
    self,
    surface: options.surface ?? Surface.Page,
    over: options.over ?? null,
    context: {
      focused: () => self,
      selection: () => selection,
      subscribe: () => () => undefined,
    },
    open: record("open"),
    navigate: record("navigate"),
    replace: record("replace"),
    setParams: record("setParams"),
    back: record("back"),
    expand: record("expand"),
    close: record("close"),
    focus: record("focus"),
    crumbs: () => crumbs,
    setTitle: record("setTitle"),
    setDirty: record("setDirty"),
    select: record("select"),
    pick: (ref, onPick, pickOptions) => {
      calls.push({ method: "pick", args: [ref, onPick, pickOptions] } as ApiCall);
      pending.push(onPick as (value: unknown) => void);
    },
    answer: record("answer"),
  };

  return {
    api,
    calls,
    callsTo: (method) =>
      calls.filter(
        (c): c is Extract<ApiCall, { method: typeof method }> => c.method === method,
      ),
    respond: (value) => pending.pop()?.(value),
  };
}
