import { Component } from 'react';

/**
 * Class component — React error boundaries must be class-based.
 * Catches render errors from any child and shows a recovery UI.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, send to your error monitoring (e.g. Sentry, Datadog)
    console.error('[AILCL Widget] Unhandled error:', error, info.componentStack);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="ailcl-error-boundary">
          <span className="ailcl-error-boundary__icon">⚠️</span>
          <p className="ailcl-error-boundary__title">Widget Error</p>
          <p className="ailcl-error-boundary__message">
            Something went wrong in the AI Chat Widget. Please try again.
          </p>
          <button className="ailcl-error-boundary__btn" onClick={this.handleRetry}>
            Reload Widget
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;