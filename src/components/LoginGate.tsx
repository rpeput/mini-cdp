import type { WorkflowTabId } from '../types/cdp.ts';
import { LandingPage } from './LandingPage.tsx';

interface LoginGateProps {
  onLogin: (openXRay: boolean, initialTab?: WorkflowTabId) => void;
}

export function LoginGate({ onLogin }: LoginGateProps) {
  return (
    <LandingPage
      onEnterWorkspace={(initialTab, openXRay) =>
        onLogin(Boolean(openXRay), initialTab)
      }
    />
  );
}
