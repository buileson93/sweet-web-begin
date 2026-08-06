export type FraudRiskLevel = 'high' | 'medium' | 'low';

export type FraudAttempt = {
  sessionId: string;
  candidateName: string;
  unit: string;
  quizTitle: string;
  integrityScore: number;
  startedAt: string;
  fingerprint: string;
  deviceInfo: any;
  eventSummary: Record<string, number>;
  riskLevel: FraudRiskLevel;
  riskReason: string;
};

export type FingerprintLog = {
  id: string;
  session_id: string;
  kind: string;
  details: any;
  created_at: string;
};
