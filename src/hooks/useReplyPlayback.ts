import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignRecord } from '../types/cdp.ts';
import { applyPlaybackEvent, buildPlaybackEvents, EMPTY_PLAYBACK, playableReplyIds, type PlaybackState } from '../utils/motionSequence.ts';

const SETTLE_MS = 260;

/**
 * Plays simulated replies arriving one by one. This only *presents* data that is already final in the app:
 * `state` is null whenever nothing is playing, and the screen then shows the real replies. A run starts
 * only when `runId` changes while the page is mounted (the reply was simulated here), never on a revisit,
 * and never with reduced motion. `skip` ends the run at the final values.
 */
export function useReplyPlayback(campaign: CampaignRecord | undefined, runId: number, runCampaignId: string | null) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<PlaybackState | null>(null);
  const seenRun = useRef(runId);
  const campaignRef = useRef(campaign);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    campaignRef.current = campaign;
  });

  const stop = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => {
    if (runId === seenRun.current) return;
    seenRun.current = runId;
    const target = campaignRef.current;
    if (reduced || !target || target.id !== runCampaignId || !target.simulated) return;
    const events = buildPlaybackEvents(playableReplyIds(target));
    if (!events.length) return;
    setState(EMPTY_PLAYBACK);
    for (const event of events) {
      timers.current.push(window.setTimeout(() => setState((current) => (current ? applyPlaybackEvent(current, event) : current)), event.at));
    }
    const end = events[events.length - 1].at + SETTLE_MS;
    timers.current.push(window.setTimeout(() => setState(null), end));
    return () => {
      stop();
      setState(null);
    };
  }, [runId, runCampaignId, reduced, stop]);

  // Switching to another campaign ends a run that belongs to the first.
  const campaignId = campaign?.id;
  useEffect(() => () => {
    stop();
    setState(null);
  }, [campaignId, stop]);

  const skip = useCallback(() => {
    stop();
    setState(null);
  }, [stop]);

  return { state, playing: state !== null, skip };
}
