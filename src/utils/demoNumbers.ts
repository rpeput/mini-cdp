import type { RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';

export interface DemoOutcome {
  sent: number;
  accepted: number;
  declined: number;
  pending: number;
}

export interface DemoNumbers {
  messages: number;
  profiles: number;
  sent: number;
  accepted: number;
  /** Friends who have not agreed to receive invitations; they are never recipients. */
  notConsented: number;
}

/**
 * The numbers behind the landing page's "from the demo" strip. Messages and friends are counted from
 * the seed data; sent and accepted come from the campaign outcome, which the tests check against a real run.
 */
export function buildDemoNumbers(records: readonly RawSourceRecord[], profiles: readonly UnifiedProfile[], outcome: DemoOutcome): DemoNumbers {
  return {
    messages: records.length,
    profiles: profiles.length,
    sent: outcome.sent,
    accepted: outcome.accepted,
    notConsented: profiles.filter((profile) => !profile.consentPdpa).length,
  };
}
