import {
  formatRef,
  loadView,
  type Registry,
  type ResourceRef,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { ICONO_ROTO, Missing } from "@sincpro/web-ui";
import {
  Component,
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
 */

class ErrorBoundary extends Component<
  { children: ReactNode; name: string },
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
    return (
      <Missing
        icon={ICONO_ROTO}
        tone="bad"
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

  const View = useMemo(
    () => (spec === null ? null : lazy(async () => ({ default: await loadView(spec) }))),
    [spec],
  );

  if (spec === null || View === null) {
    return (
      <Missing
        heading={composerCopy().view.unresolved}
        detail={`${key} — is the «${resource.domain}» domain missing from the registry?`}
      />
    );
  }

  return (
    <ErrorBoundary name={key}>
      <Suspense
        fallback={
          fallback ?? (
            <p className="p-4 text-micro text-muted">
              {composerCopy().view.loading(spec.domain)}
            </p>
          )
        }
      >
        <View key={key} resource={resource} api={api} />
      </Suspense>
    </ErrorBoundary>
  );
}

export const ViewHost = memo(Host);
