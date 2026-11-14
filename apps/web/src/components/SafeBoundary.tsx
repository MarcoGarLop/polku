import { Component, type ReactNode } from 'react';

/** Keeps the map and the rest of the demo alive if one panel throws. */
export class SafeBoundary extends Component<{ children: ReactNode; label: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="card small" style={{ margin: 12 }}>
          <b>{this.props.label} hit a problem.</b>
          <div className="muted tiny" style={{ margin: '4px 0 8px' }}>{this.state.error.message}</div>
          <button className="btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    return this.props.children;
  }
}
