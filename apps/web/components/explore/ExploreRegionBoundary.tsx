'use client';

import { Component, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { View } from '@acme/ui/tw';
import { MightsButton, MightsText } from '@acme/ui/mights';

interface BoundaryProps {
  region: string;
  children: ReactNode;
  onRetry: () => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * One error boundary per Suspense region, so a failed read takes out a pane,
 * not the workspace. Retry re-requests the route's server payload; the fresh
 * promises land as new props and the boundary clears itself in
 * `componentDidUpdate`.
 */
class RegionBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <View role="alert" className="items-start gap-3 border border-rule-hairline bg-surface-sunken p-5">
          <MightsText tone="default">{`This ${this.props.region} couldn't load.`}</MightsText>
          <MightsButton
            size="sm"
            variant="secondary"
            onPress={() => {
              this.setState({ error: null });
              this.props.onRetry();
            }}
          >
            Try again
          </MightsButton>
        </View>
      );
    }
    return this.props.children;
  }
}

export function ExploreRegionBoundary({ region, children }: { region: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <RegionBoundaryInner region={region} onRetry={() => router.refresh()}>
      {children}
    </RegionBoundaryInner>
  );
}
