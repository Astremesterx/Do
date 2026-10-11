import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="error-page">
          <span className="do-wordmark">DO.</span>
          <h1>Let’s get you back out there.</h1>
          <p>This screen could not load. Your saved data stays on this device.</p>
          <button className="primary-button" onClick={() => window.location.reload()}>
            Reload DO
          </button>
        </main>
      )
    return this.props.children
  }
}
