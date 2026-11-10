"use client";

import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";

class ViewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="loading-state" role="alert">
        <p>Could not open this view.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Load expensive views only when opened, keeping navigation available. */
export function lazyView<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
) {
  const View = lazy(load);
  return function DeferredView(props: Props) {
    return (
      <ViewBoundary>
        <Suspense
          fallback={
            <div className="loading-state" role="status">
              Loading view…
            </div>
          }
        >
          <View {...props} />
        </Suspense>
      </ViewBoundary>
    );
  };
}
