import {
  Destination,
  type ResourceRef,
  Surface,
  useWorkspaceContext,
  type ViewProps,
  type WorkspaceApi,
} from "@sincpro/web-composer";
import { RecordLink } from "@sincpro/web-composer";
import {
  Block,
  Button,
  DataField,
  DensityProvider,
  List,
  Menu,
  Record,
  StatusDot,
  Table,
  Tag,
  Td,
  Th,
  THead,
  Tr,
} from "@sincpro/web-ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  type Apunte,
  APUNTES,
  type Asiento,
  asientoById,
  contactoNombre,
  CONTACTOS,
  cuentaNombre,
  CUENTAS,
  db,
  ESTADO_LABEL,
  money,
  TIPO_LABEL,
  useAsientos,
} from "./datos";
import { Many2One } from "./many2one";

/* ── References ──────────────────────────────────────────────────────── */

export const asientoRef = (id: string): ResourceRef => ({
  domain: "contabilidad",
  kind: "asiento",
  id,
});
export const apunteRef = (id: string): ResourceRef => ({
  domain: "contabilidad",
  kind: "apunte",
  id,
});
export const contactoRef = (id: string): ResourceRef => ({
  domain: "contabilidad",
  kind: "contacto",
  id,
});
export const ASIENTOS: ResourceRef = { domain: "contabilidad", kind: "asientos" };
export const APUNTES_REF: ResourceRef = { domain: "contabilidad", kind: "apuntes" };
export const CONCILIAR: ResourceRef = { domain: "contabilidad", kind: "conciliar" };
export const FACTURA_NUEVA: ResourceRef = { domain: "contabilidad", kind: "factura-nueva" };
export const apuntesDeCuenta = (cuenta: string): ResourceRef => ({
  ...APUNTES_REF,
  params: { cuenta },
});
export const apuntesDeAsiento = (asiento: string): ResourceRef => ({
  ...APUNTES_REF,
  params: { asiento },
});
export const elegir = (de: "contacto" | "cuenta"): ResourceRef => ({
  domain: "contabilidad",
  kind: "elegir",
  params: { de },
});

const TIPO_TONE = { factura: "info", pago: "good", extracto: "neutral" } as const;
const ESTADO_TONE = { borrador: "neutral", publicado: "warn", conciliado: "good" } as const;

/* ── The sheet a view is drawn on ─────────────────────────────────────── */

/**
 * ONE place decides the frame of a view by where it is drawn. On the page: air around it and a
 * card, like any screen of the ERP. In a panel, a window or the peek: flush — the panel's frame
 * is already the card, and a second border inside it is noise.
 */
function Hoja({ api, children }: { api: WorkspaceApi; children: ReactNode }) {
  if (api.surface !== Surface.Page)
    return (
      <Compacta api={api}>
        <div className="@container bg-surface">{children}</div>
      </Compacta>
    );
  return (
    <div className="bg-ground p-6">
      <div className="@container overflow-hidden rounded-box border border-line-strong bg-surface">
        {children}
      </div>
    </div>
  );
}

/**
 * The density is the APP's decision, not the composer's: in the peek — a narrow drawer — the
 * views draw compact. The composer only says which surface they are on.
 */
function Compacta({ api, children }: { api: WorkspaceApi; children: ReactNode }) {
  if (api.surface !== Surface.Peek) return children;
  return <DensityProvider value="compact">{children}</DensityProvider>;
}

/* ── A selection a list publishes ────────────────────────────────────── */

/** The checkbox state of a list, and the references it publishes to the workspace. A detail
 *  panel or an assistant elsewhere follows these without knowing what they are. */
function useSelection<T>(
  api: WorkspaceApi,
  keyOf: (item: T) => string,
  refOf: (item: T) => ResourceRef,
  items: readonly T[],
  single = false,
) {
  const [picked, setPicked] = useState<readonly string[]>([]);
  const alive = useMemo(
    () => picked.filter((k) => items.some((i) => keyOf(i) === k)),
    [picked, items, keyOf],
  );

  useEffect(() => {
    api.select(items.filter((i) => alive.includes(keyOf(i))).map(refOf));
  }, [alive, api, items, keyOf, refOf]);

  return {
    has: (id: string) => alive.includes(id),
    toggle: (id: string) =>
      setPicked((now) =>
        now.includes(id) ? now.filter((k) => k !== id) : single ? [id] : [...now, id],
      ),
    count: alive.length,
    clear: () => setPicked([]),
  };
}

/* ── N records: asientos ─────────────────────────────────────────────── */

/**
 * Los asientos contables — facturas, pagos y líneas de extracto bancario — como lista. Es el
 * caso de «N registros»: un clic en una fila abre el asiento COMO PÁGINA (la miga guarda el
 * camino) y el control de la derecha lo mira en un vistazo.
 */
export function Asientos({ resource, api }: ViewProps) {
  const all = useAsientos();
  const tipo = resource.params?.["tipo"];
  const items = useMemo(
    () => all.filter((a) => tipo === undefined || a.tipo === tipo),
    [all, tipo],
  );
  const selection = useSelection(
    api,
    (a: Asiento) => a.id,
    (a) => asientoRef(a.id),
    items,
  );

  return (
    <Hoja api={api}>
      <List<Asiento>
        items={items}
        keyOf={(a) => a.id}
        present="table"
        selection={selection}
        onOpen={(a) => api.open(asientoRef(a.id))}
        onPeek={(a) => api.open(asientoRef(a.id), { to: Destination.Peek })}
        empty={{ sentence: "No hay asientos." }}
      >
        <List.Bar>
          <List.Crumbs crumbs={api.crumbs()} />
          <List.Identity
            title="Asientos contables"
            description="facturas, pagos y extractos bancarios"
          />
        </List.Bar>
        <List.Rows<Asiento>
          row={(a) => ({
            name: a.id,
            meta: `${TIPO_LABEL[a.tipo]} · ${contactoNombre(a.contacto)} · ${a.fecha} · ${money(a.total)}`,
            tags: <Tag tone={ESTADO_TONE[a.estado]}>{ESTADO_LABEL[a.estado]}</Tag>,
          })}
        />
        <List.Table<Asiento>
          columns={[
            {
              id: "id",
              header: "número",
              cell: (a: Asiento) => (
                <RecordLink api={api} resource={asientoRef(a.id)}>
                  {a.id}
                </RecordLink>
              ),
              value: (a: Asiento) => a.id,
            },
            { id: "fecha", header: "fecha", value: (a: Asiento) => a.fecha },
            { id: "tipo", header: "tipo", value: (a: Asiento) => TIPO_LABEL[a.tipo] },
            {
              id: "contacto",
              header: "contacto",
              value: (a: Asiento) => contactoNombre(a.contacto),
            },
            {
              id: "estado",
              header: "estado",
              value: (a: Asiento) => ESTADO_LABEL[a.estado],
            },
            {
              id: "total",
              header: "total",
              cell: (a: Asiento) => money(a.total),
              value: (a: Asiento) => a.total,
              numeric: true,
              aggregate: "sum",
            },
          ]}
        />
      </List>
    </Hoja>
  );
}

/* ── N records: apuntes ──────────────────────────────────────────────── */

/**
 * Los apuntes: las LÍNEAS de muchos asientos juntas, para mirar el sistema contable por
 * cuenta y no por documento. Una fila ya no es un asiento sino una de sus líneas: abrirla lleva
 * al asiento de donde viene.
 */
export function Apuntes({ resource, api }: ViewProps) {
  const cuenta = resource.params?.["cuenta"];
  const asiento = resource.params?.["asiento"];
  const items = useMemo(
    () =>
      APUNTES.filter(
        (l) =>
          (cuenta === undefined || l.cuenta === cuenta) &&
          (asiento === undefined || l.asiento === asiento),
      ),
    [cuenta, asiento],
  );
  const selection = useSelection(
    api,
    (l: Apunte) => l.id,
    (l) => apunteRef(l.id),
    items,
  );
  const all = useAsientos();
  const fecha = (l: Apunte) => asientoById(all, l.asiento)?.fecha ?? "";

  return (
    <Hoja api={api}>
      <List<Apunte>
        items={items}
        keyOf={(l) => l.id}
        present="table"
        selection={selection}
        onOpen={(l) => api.open(asientoRef(l.asiento))}
        onPeek={(l) => api.open(asientoRef(l.asiento), { to: Destination.Peek })}
        empty={{ sentence: "No hay apuntes." }}
      >
        <List.Bar>
          <List.Crumbs crumbs={api.crumbs()} />
          <List.Identity
            title={
              cuenta === undefined
                ? "Apuntes contables"
                : `Apuntes de ${cuenta} · ${cuentaNombre(cuenta)}`
            }
            description="las líneas de los asientos, por cuenta"
          />
        </List.Bar>
        <List.Rows<Apunte>
          row={(l) => ({
            name: `${l.cuenta} ${cuentaNombre(l.cuenta)}`,
            meta: `${l.asiento} · ${l.etiqueta}`,
            tags: (
              <span className="text-meta text-ink tabular-nums">
                {l.debe > 0 ? `D ${money(l.debe)}` : `H ${money(l.haber)}`}
              </span>
            ),
          })}
        />
        <List.Table<Apunte>
          totals
          columns={[
            { id: "fecha", header: "fecha", value: fecha },
            {
              id: "asiento",
              header: "asiento",
              cell: (l: Apunte) => (
                <RecordLink api={api} resource={asientoRef(l.asiento)}>
                  {l.asiento}
                </RecordLink>
              ),
              value: (l: Apunte) => l.asiento,
            },
            {
              id: "cuenta",
              header: "cuenta",
              value: (l: Apunte) => `${l.cuenta} ${cuentaNombre(l.cuenta)}`,
            },
            { id: "etiqueta", header: "etiqueta", value: (l: Apunte) => l.etiqueta },
            {
              id: "debe",
              header: "débito",
              cell: (l: Apunte) => (l.debe === 0 ? "—" : money(l.debe)),
              value: (l: Apunte) => l.debe,
              numeric: true,
              aggregate: "sum",
            },
            {
              id: "haber",
              header: "crédito",
              cell: (l: Apunte) => (l.haber === 0 ? "—" : money(l.haber)),
              value: (l: Apunte) => l.haber,
              numeric: true,
              aggregate: "sum",
            },
          ]}
        />
      </List>
    </Hoja>
  );
}

/* ── One record: asiento ─────────────────────────────────────────────── */

const ETAPAS = [
  { id: "borrador", label: "borrador" },
  { id: "publicado", label: "publicado" },
  { id: "conciliado", label: "conciliado" },
];

/** Las líneas de un asiento: lo mismo en la página, en una ventana, en el vistazo y en el
 *  panel que sigue a una selección. */
export function Lineas({ asiento, api }: { asiento: string; api: WorkspaceApi }) {
  const lineas = APUNTES.filter((l) => l.asiento === asiento);
  return (
    <Table height={180}>
      <THead>
        <Th>cuenta</Th>
        <Th>etiqueta</Th>
        <Th numeric>débito</Th>
        <Th numeric>crédito</Th>
      </THead>
      <tbody>
        {lineas.map((l) => (
          <Tr key={l.id}>
            <Td>
              <RecordLink
                api={api}
                resource={apuntesDeCuenta(l.cuenta)}
                to={Destination.Side}
              >
                {`${l.cuenta} ${cuentaNombre(l.cuenta)}`}
              </RecordLink>
            </Td>
            <Td>{l.etiqueta}</Td>
            <Td numeric>{l.debe === 0 ? "—" : money(l.debe)}</Td>
            <Td numeric>{l.haber === 0 ? "—" : money(l.haber)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** The lines as a compact list: a panel, a window or the peek is too narrow for four columns. */
function LineasCompactas({ asiento }: { asiento: string }) {
  return (
    <ul className="flex flex-col divide-y divide-line text-meta">
      {APUNTES.filter((l) => l.asiento === asiento).map((l) => (
        <li key={l.id} className="flex items-baseline gap-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-ink">
            {l.cuenta} {cuentaNombre(l.cuenta)}
          </span>
          <span className="shrink-0 text-ink tabular-nums">
            {l.debe > 0 ? money(l.debe) : `(${money(l.haber)})`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * UN asiento: su riel con la miga, los hechos, y sus líneas. La miga la dibuja el `Record` con
 * lo que el composer le da (`api.crumbs()`): en la página es el camino completo; en una ventana
 * o un vistazo es sólo el asiento. Quien lo abre en una ventana puede agrandarlo a página.
 */
export function AsientoView({ resource, api }: ViewProps) {
  const all = useAsientos();
  const a = asientoById(all, resource.id);
  if (a === undefined)
    return <p className="p-4 text-meta text-muted">No existe el asiento.</p>;

  const other = asientoById(all, a.conciliadoCon);
  return (
    <Compacta api={api}>
      <div className={api.surface === Surface.Page ? "bg-ground p-4" : "bg-ground"}>
        <Record
          identity={{
            title: a.id,
            tag: { label: TIPO_LABEL[a.tipo], tone: TIPO_TONE[a.tipo] },
          }}
        >
          <Record.Rail>
            <Record.Crumbs crumbs={api.crumbs()} />
            <Record.Actions>
              <Button
                size="sm"
                role="secondary"
                onClick={() => api.open(apuntesDeAsiento(a.id), { to: Destination.Side })}
              >
                Ver apuntes
              </Button>
            </Record.Actions>
            {/* The stage bar needs the page's width; a window or a peek says it in a word. */}
            {api.surface === Surface.Page ? (
              <Record.Status stages={ETAPAS} current={a.estado} />
            ) : null}
          </Record.Rail>

          <Record.Paper layout="horizontal">
            <Record.Facts
              fields={[
                { label: "Contacto", value: contactoNombre(a.contacto) },
                { label: "Fecha", value: a.fecha },
                { label: "Referencia", value: a.ref },
                { label: "Total", value: money(a.total) },
                ...(api.surface === Surface.Page
                  ? []
                  : [
                      {
                        label: "Estado",
                        value: (
                          <Tag tone={ESTADO_TONE[a.estado]}>{ESTADO_LABEL[a.estado]}</Tag>
                        ),
                      },
                    ]),
                {
                  label: "Conciliado con",
                  value:
                    other === undefined ? (
                      "—"
                    ) : (
                      <RecordLink api={api} resource={asientoRef(other.id)}>
                        {other.id}
                      </RecordLink>
                    ),
                },
              ]}
            />
            <Record.Pages current="lineas" onChange={() => {}}>
              <Record.Page
                id="lineas"
                label="apuntes"
                count={APUNTES.filter((l) => l.asiento === a.id).length}
              >
                {/* A menu INSIDE the record, so the peek has one: its Escape closes the menu and
                  must not close the drawer too. */}
                <div className="flex justify-end pb-1">
                  <Menu
                    label="Más del asiento"
                    variant="text"
                    align="end"
                    groups={[
                      {
                        options: [
                          { id: "copiar", label: "Copiar el número" },
                          { id: "imprimir", label: "Imprimir" },
                        ],
                      },
                    ]}
                    onSelect={() => {}}
                  />
                </div>
                <Block title="debe y haber" flush>
                  {api.surface === Surface.Page ? (
                    <Lineas asiento={a.id} api={api} />
                  ) : (
                    <LineasCompactas asiento={a.id} />
                  )}
                </Block>
              </Record.Page>
            </Record.Pages>
          </Record.Paper>
        </Record>
      </div>
    </Compacta>
  );
}

/* ── Two contexts: conciliar ─────────────────────────────────────────── */

/**
 * La página de la conciliación: los extractos bancarios que faltan por conciliar. Marcar uno lo
 * publica como selección; el panel de al lado —otra vista, quizá de otro equipo— lo sigue.
 */
export function Conciliar({ api }: ViewProps) {
  const all = useAsientos();
  const items = useMemo(
    () => all.filter((a) => a.tipo === "extracto" && a.estado !== "conciliado"),
    [all],
  );
  const selection = useSelection(
    api,
    (a: Asiento) => a.id,
    (a) => asientoRef(a.id),
    items,
    true,
  );

  return (
    <Hoja api={api}>
      <List<Asiento>
        items={items}
        keyOf={(a) => a.id}
        present="table"
        selection={selection}
        empty={{ sentence: "Todo está conciliado." }}
      >
        <List.Bar>
          <List.Crumbs crumbs={api.crumbs()} />
          <List.Identity
            title="Extracto bancario"
            description="marca una línea y concilíala con lo pendiente"
          />
        </List.Bar>
        <List.Rows<Asiento>
          row={(a) => ({ name: a.ref, meta: `${a.id} · ${a.fecha} · ${money(a.total)}` })}
        />
        <List.Table<Asiento>
          columns={[
            { id: "id", header: "línea", value: (a: Asiento) => a.id },
            { id: "fecha", header: "fecha", value: (a: Asiento) => a.fecha },
            { id: "ref", header: "referencia", value: (a: Asiento) => a.ref },
            {
              id: "total",
              header: "importe",
              cell: (a: Asiento) => money(a.total),
              value: (a: Asiento) => a.total,
              numeric: true,
            },
          ]}
        />
      </List>
    </Hoja>
  );
}

/** Lo pendiente de pagar o cobrar que podría corresponder a la línea marcada. Esta vista no
 *  sabe de dónde viene la selección: lee una referencia del contexto. */
export function Candidatos({ api }: ViewProps) {
  const all = useAsientos();
  const { selection } = useWorkspaceContext(api);
  const line = asientoById(all, selection[0]?.id);

  if (line === undefined || line.tipo !== "extracto")
    return (
      <p className="p-4 text-meta text-muted">
        Marca una línea del extracto para ver con qué se concilia.
      </p>
    );

  const candidatos = all
    .filter((a) => a.tipo !== "extracto" && a.estado === "publicado")
    .sort((a, b) => Number(b.total === line.total) - Number(a.total === line.total));

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-meta text-ink">
        <strong className="font-medium">{line.id}</strong> · {money(line.total)} ·{" "}
        {contactoNombre(line.contacto)}
      </p>
      {candidatos.length === 0 ? (
        <p className="text-meta text-muted">Sin coincidencias.</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {candidatos.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-meta">
            <RecordLink api={api} resource={asientoRef(c.id)} compact>
              {c.id}
            </RecordLink>
            <span className="text-muted">{contactoNombre(c.contacto)}</span>
            <span className="ml-auto text-ink tabular-nums">{money(c.total)}</span>
            {c.total === line.total ? <Tag tone="good">coincide</Tag> : null}
            <Button
              size="sm"
              role="secondary"
              aria-label={`Conciliar con ${c.id}`}
              onClick={() => db.reconcile(line.id, c.id)}
            >
              Conciliar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El detalle que sigue a la selección de otra lista: marca un apunte y aquí aparece su asiento. */
export function Seguidor({ api }: ViewProps) {
  const all = useAsientos();
  const { selection } = useWorkspaceContext(api);
  const first = selection[0];
  const id = first?.kind === "apunte" ? first.id?.split("#")[0] : first?.id;
  const a = asientoById(all, id);

  if (a === undefined)
    return (
      <p className="p-4 text-meta text-muted">Marca un apunte y verás aquí su asiento.</p>
    );
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <RecordLink api={api} resource={asientoRef(a.id)}>
          {a.id}
        </RecordLink>
        <StatusDot tone={ESTADO_TONE[a.estado]} label={ESTADO_LABEL[a.estado]} />
        <span className="ml-auto text-meta text-ink tabular-nums">{money(a.total)}</span>
      </div>
      <p className="text-micro text-muted">
        {contactoNombre(a.contacto)} · {a.fecha}
      </p>
      <LineasCompactas asiento={a.id} />
    </div>
  );
}

/* ── A form: factura nueva ───────────────────────────────────────────── */

/** Un contacto, para mirarlo sin salir del formulario que lo eligió. */
export function ContactoView({ resource, api }: ViewProps) {
  const c = CONTACTOS.find((x) => x.id === resource.id);
  const facturas = useAsientos().filter(
    (a) => a.contacto === resource.id && a.tipo === "factura",
  );
  return (
    <div className="flex flex-col gap-2 p-3">
      <DataField label="Contacto" value={c?.nombre ?? "—"} />
      <DataField label="NIT" value={c?.nit ?? "—"} />
      <p className="text-micro text-muted">Facturas</p>
      <ul className="flex flex-col gap-0.5 text-meta">
        {facturas.map((f) => (
          <li key={f.id}>
            <RecordLink api={api} resource={asientoRef(f.id)}>
              {f.id}
            </RecordLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Una lista para ELEGIR: no abre nada, RESPONDE a quien preguntó. */
export function Elegir({ resource, api }: ViewProps) {
  const de = resource.params?.["de"];
  const rows =
    de === "cuenta"
      ? CUENTAS.map((c) => ({ id: c.id, nombre: `${c.id} · ${c.nombre}` }))
      : CONTACTOS.map((c) => ({ id: c.id, nombre: c.nombre }));
  const kind = de === "cuenta" ? "apuntes" : "contacto";
  return (
    <ul className="flex flex-col gap-1 p-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-meta">
          <span className="flex-1 text-ink">{r.nombre}</span>
          <Button
            size="sm"
            role="secondary"
            aria-label={`Elegir ${r.nombre}`}
            onClick={() => api.answer({ domain: "contabilidad", kind, id: r.id })}
          >
            Elegir
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** El formulario de una factura. El contacto y la cuenta son many2one: se eligen tipeando, se
 *  abren en una ventana, se buscan en una lista que responde al campo. */
export function FacturaNueva({ api }: ViewProps) {
  const [contacto, setContacto] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<string | null>("4.1.1");
  const [notas, setNotas] = useState("");
  /* Lo escrito sin guardar: mientras lo haya, una miga, cerrar o el Atrás del navegador
     preguntan antes de tirarlo. */
  const dirty = contacto !== null || notas !== "";
  useEffect(() => api.setDirty(dirty), [api, dirty]);

  return (
    <div className={api.surface === Surface.Page ? "bg-ground p-4" : "bg-ground"}>
      <Record
        identity={{ title: "Factura nueva", tag: { label: "borrador", tone: "neutral" } }}
      >
        <Record.Rail>
          <Record.Crumbs crumbs={api.crumbs()} />
          <Record.Actions>
            {/* `close`: en la página vuelve atrás, en un panel o el vistazo lo cierra. */}
            <Button size="sm" role="ghost" onClick={api.close}>
              Descartar
            </Button>
          </Record.Actions>
        </Record.Rail>
        <Record.Paper layout="stacked">
          <div className="flex max-w-xl flex-col gap-3 p-4">
            <label className="flex flex-col gap-1 text-micro text-muted">
              Contacto
              <Many2One
                api={api}
                label="Contacto"
                value={contacto}
                options={CONTACTOS}
                recordOf={contactoRef}
                chooserOf={elegir("contacto")}
                onChange={setContacto}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              Cuenta de ingresos
              <Many2One
                api={api}
                label="Cuenta"
                value={cuenta}
                options={CUENTAS.map((c) => ({ id: c.id, nombre: `${c.id} · ${c.nombre}` }))}
                recordOf={apuntesDeCuenta}
                chooserOf={elegir("cuenta")}
                onChange={setCuenta}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              Notas
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="rounded-control border border-line-strong bg-surface p-2 text-meta text-ink"
              />
            </label>
          </div>
        </Record.Paper>
      </Record>
    </div>
  );
}
