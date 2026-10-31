import assert from "node:assert/strict";

import {
  createApiFactory,
  createWorkspaceStore,
  registerAgentTool,
  toolName,
  workspaceTools,
} from "@sincpro/web-composer";
import {
  createRegistry,
  Destination,
  EMPTY,
  push,
  type ResourceRef,
  select,
  Surface,
  type ViewSpec,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { createElement } from "react";
import { afterEach, test } from "vitest";

const ASIENTOS = { domain: "contabilidad", kind: "asientos" };
const FAC = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };

const View = () => createElement("p", null, "view");
const SPECS: readonly ViewSpec[] = [
  {
    domain: "contabilidad",
    kind: "asientos",
    title: () => "Asientos",
    load: async () => View,
  },
  {
    domain: "contabilidad",
    kind: "asiento",
    title: (r) => `Asiento ${r.id}`,
    actions: () => [
      { id: "post", label: "Publicar", run: (api) => api.setTitle("publicado") },
    ],
    search: async (q) =>
      q.includes("12") ? [{ ref: FAC, label: "FAC-12", detail: "Acme" }] : [],
    load: async () => View,
  },
];
const REGISTRY = createRegistry(SPECS);

type Registered = { tool: Record<string, unknown>; signal: AbortSignal | undefined };

/** The browser's side of WebMCP, as the draft has it: `document.modelContext.registerTool`. */
function installModelContext(): Registered[] {
  const registered: Registered[] = [];
  (globalThis as { document?: unknown }).document = {
    modelContext: {
      registerTool: async (
        tool: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => {
        registered.push({ tool, signal: options?.signal });
      },
    },
  };
  return registered;
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

const run = (r: Registered, input: Record<string, unknown> = {}) =>
  (r.tool["execute"] as (i: Record<string, unknown>) => Promise<unknown>)(input);

test("without WebMCP in the browser a tool is a no-op, not an error", () => {
  const stop = registerAgentTool({ name: "x", description: "x", execute: () => 1 });
  assert.doesNotThrow(stop);
});

test("a tool is offered with a signal, and stopping it aborts the signal", async () => {
  const registered = installModelContext();
  const stop = registerAgentTool({
    name: "hello",
    description: "says hi",
    execute: () => "hi",
  });

  assert.equal(registered[0]!.tool["name"], "hello");
  assert.deepEqual(registered[0]!.tool["inputSchema"], { type: "object", properties: {} });
  assert.equal(await run(registered[0]!), "hi");

  stop();
  assert.equal(registered[0]!.signal?.aborted, true, "aborting the signal unregisters it");
});

test("a tool name is made valid: only A-Z a-z 0-9 _ - . and at most 128", () => {
  assert.equal(toolName("register payment:FAC/12"), "register_payment_FAC_12");
  assert.equal(toolName("x".repeat(200)).length, 128);
});

test("the workspace as tools: where, open, search and act go through the same workspace", async () => {
  const registered = installModelContext();
  const store = createWorkspaceStore({
    initial: select(push(EMPTY, ASIENTOS), "page", [FAC]),
  });
  const api = createApiFactory(store, { registry: REGISTRY });
  const opened: [ResourceRef, string][] = [];
  workspaceTools({
    store,
    registry: REGISTRY,
    titleOf: api.titleOf,
    open: (ref, to) => {
      opened.push([ref, to]);
      if (to === Destination.Side) store.openPanel(ref, Zone.Right);
      else store.push(ref);
    },
    run: (action) => action.run(api.for(store.get().page!, { surface: Surface.Page })),
  }).forEach(registerAgentTool);

  const tool = (name: string) => registered.find((r) => r.tool["name"] === name)!;
  assert.deepEqual(
    registered.map((r) => r.tool["name"]),
    ["workspace.where", "workspace.open", "workspace.search", "workspace.act"],
  );

  const where = (await run(tool("workspace.where"))) as Record<string, unknown>;
  assert.deepEqual(where["page"], { ref: "contabilidad:asientos", title: "Asientos" });
  assert.deepEqual(where["selection"], [
    { ref: "contabilidad:asiento/FAC-12", title: "Asiento FAC-12" },
  ]);

  const hits = await run(tool("workspace.search"), { query: "fac 12" });
  assert.deepEqual(hits, [
    { ref: "contabilidad:asiento/FAC-12", label: "FAC-12", detail: "Acme" },
  ]);

  await run(tool("workspace.open"), { ref: "contabilidad:asiento/FAC-12", to: "side" });
  assert.deepEqual(opened, [[FAC, "side"]]);
  await assert.rejects(run(tool("workspace.open"), { ref: "ventas:pedido/1" }), /No screen/);

  store.focusPanel(store.get().panels[0]!.id);
  const actions = ((await run(tool("workspace.where"))) as { actions: unknown })["actions"];
  assert.deepEqual(
    actions,
    [{ id: "post", label: "Publicar" }],
    "the focused record's actions",
  );
  assert.equal(await run(tool("workspace.act"), { action: "post" }), "Done: Publicar.");
  await assert.rejects(run(tool("workspace.act"), { action: "nope" }), /no action/);
});
