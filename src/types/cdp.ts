export type DataSourceType = 'LINE_CHAT' | 'FACEBOOK_POST' | 'DEPT_ROSTER';

export type AttributeCategory = 'food' | 'activity' | 'vibe' | 'budget';

export type AttributeStatus = 'verified' | 'needs_review' | 'rejected';

export type CampaignInteractionStatus = 'accepted' | 'declined' | 'pending';

export type CampaignMatchTier = 'direct' | 'lookalike';

export type AiAction = 'stitch' | 'segment' | 'simulate_replies';

export interface RawSourceRecord {
  id: string;
  source: DataSourceType;
  handle: string;
  rawText: string;
  timestamp: string;
  linkedProfileId: string;
}

export interface ExtractedAttribute {
  id: string;
  category: AttributeCategory;
  value: string;
  confidence: number;
  evidenceQuote: string;
  source: DataSourceType;
  status: AttributeStatus;
}

export interface CampaignInteraction {
  campaignId: string;
  campaignName: string;
  status: CampaignInteractionStatus;
  sentMessage: string;
  replyText?: string;
  timestamp: string;
}

export interface UnifiedProfile {
  id: string;
  fullName: string;
  nickname: string;
  studentId: string;
  avatarInitials: string;
  avatarColor: string;
  consentPdpa: boolean;
  attributes: ExtractedAttribute[];
  mergedSources: RawSourceRecord[];
  campaignHistory: CampaignInteraction[];
  isStitched: boolean;
}

export interface CampaignMatch {
  profileId: string;
  tier: CampaignMatchTier;
  matchScore: number;
  aiReasoning: string;
  personalizedInvite: string;
  selected: boolean;
}

export interface PipelineLog {
  id: string;
  timestamp: string;
  step: string;
  detail: string;
  latencyMs: number;
}

export interface AiProxyRequest<TPayload = unknown> {
  action: AiAction;
  payload: TPayload;
}

export type AiProxyResponse<TData = unknown> =
  | {
      fallback: true;
      reason?: string;
    }
  | {
      fallback: false;
      action: AiAction;
      model?: string;
      data: TData;
    };

export type WorkflowTabId = 'collect' | 'profiles' | 'segment' | 'analytics';

export interface CampaignReplySummary {
  profileId: string;
  status: CampaignInteractionStatus;
  replyText: string;
  tier: CampaignMatchTier;
  feedbackTag: string;
  feedbackCategory?: AttributeCategory;
}

export interface CampaignRecord {
  id: string;
  name: string;
  createdAt: string;
  matches: CampaignMatch[];
  simulated: boolean;
  closedLoopUpdatesCount: number;
  replies: CampaignReplySummary[];
}
