import {
  formatRef,
  loadView,
  type Registry,
  type ResourceRef,
  rootRef,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { type NoticeProps, useSkin } from "@sincpro/web-composer/shell/skin";
import {
  Component,
  type ComponentType,
  type ErrorInfo,
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useMemo,
} from "react";

/**
 * The only thing that turns a reference into pixels. Resolves against the
 * registry, isolates failure, and lends the navigation API — the view never
 * receives workspace state, or two domains would couple through it.
 *
 * Three distinct states because each one is someone else's job: unregistered
 * is wiring, loading is normal, broken is a domain bug.
 *
 * The view is keyed by the resource WITHOUT its params: another record is another view, but
 * another face of the same one — a filter, a tab, `api.setParams` — is the same view receiving
 * a new `resource`. Remounting there threw away the search typed, the scroll and the selection.
 */

/** What stands where a view could not be drawn. Plain text: it must work even when nothing
 *  else does. */
function DefaultNotice({ heading, detail, bad = false }: NoticeProps) {
  return (
    <div role="status" className="sc-notice" {...(bad ? { "data-tone": "bad" } : {})}>
      <strong>{heading}</strong>
      <code>{detail}</code>
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; name: string; Notice: ComponentType<NoticeProps> },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[view ${this.props.name}] failed to render`, error, info.componentStack);
  }

  override componentDidUpdate(prev: { name: string }) {
    if (prev.name !== this.props.name && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    const { Notice } = this.props;
    return (
      <Notice
        bad
        heading={composerCopy().view.failed}
        detail={`${this.props.name} — ${this.state.error.message}`}
      />
    );
  }
}

export type ViewHostProps = {
  resource: ResourceRef;
  registry: Registry;
  api: WorkspaceApi;
  fallback?: ReactNode;
};

function Host({ resource, registry, api, fallback }: ViewHostProps) {
  const key = formatRef(resource);
  const spec = registry.resolve(resource);
  const Notice = useSkin().Notice ?? DefaultNotice;

  const View = useMemo(
    () => (spec === null ? null : lazy(async () => ({ default: await loadView(spec) }))),
    [spec],
  );

  if (spec === null || View === null) {
    return (
      <Notice
        heading={composerCopy().view.unresolved}
        detail={`${key} — is the «${resource.domain}» domain missing from the registry?`}
      />
    );
  }

  return (
    <ErrorBoundary name={key} Notice={Notice}>
      <Suspense
        fallback={
          fallback ?? <p className="sc-loading">{composerCopy().view.loading(spec.domain)}</p>
        }
      >
        <View key={formatRef(rootRef(resource))} resource={resource} api={api} />
      </Suspense>
    </ErrorBoundary>
  );
}

export const ViewHost = memo(Host);
