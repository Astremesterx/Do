import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { failed: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DO ErrorBoundary captured an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ failed: false, error: undefined })
  }

  render() {
    if (this.state.failed) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <main className="error-page">
          <span className="do-wordmark">DO.</span>
          <h1>Let’s get you back out there.</h1>
          <p>This screen could not load. Your saved data stays on this device.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={this.handleReset}
            >
              Try again
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Reload DO
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
