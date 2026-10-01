import { Component } from 'react';

/**
 * Keeps a failing sub-tree from taking the whole page down.
 *
 * The 3D universe is the only part of TrueTube that needs WebGL; if a device
 * or driver cannot provide it, this boundary swaps in a static fallback
 * instead of unmounting the app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Surfaced for operators; the UI already degrades to the fallback.
    console.warn('TrueTube: 3D scene unavailable, using static fallback.', error?.message);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
