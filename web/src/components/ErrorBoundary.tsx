import { Component, type ReactNode } from 'react';

/**
 * A blank page tells a visitor nothing and tells us less.
 *
 * Any throw during render — a wallet library, a bad RPC response, a decode
 * failure — would otherwise unmount the whole tree and leave an empty document.
 * This catches it and shows what happened, which matters most in exactly the
 * situation where we cannot open the console: somebody else's browser.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[crux] render failed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div style={{ font: '600 17px/1 var(--serif)', letterSpacing: 3.4, color: 'var(--vellum)' }}>CRUX</div>
          <div className="legend" style={{ color: 'var(--crit)', letterSpacing: 3, marginTop: 20 }}>
            THE PLATE CRACKED
          </div>
          <div className="proposition" style={{ fontSize: 22, color: 'var(--vellum)', marginTop: 12 }}>
            Something failed while rendering.
          </div>
          <pre style={{
            font: '400 10px/1.7 var(--mono)', color: 'var(--indigo-soft)', marginTop: 16,
            textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: '1px solid var(--indigo-rule)', padding: 14,
          }}>{this.state.error.message}</pre>
          <button
            onClick={() => location.reload()}
            style={{
              marginTop: 16, border: '1px solid var(--vellum)', background: 'var(--vellum)',
              padding: '13px 26px', font: '600 10px/1 var(--sans)', letterSpacing: 2.6,
              color: 'var(--vellum-ink)',
            }}
          >RELOAD</button>
        </div>
      </div>
    );
  }
}
