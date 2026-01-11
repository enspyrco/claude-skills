export interface ReviewData {
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prDate: string;
  repository: string;

  summary: string;
  changes: string[];

  qualityAssessment: {
    codeQuality: { status: "pass" | "warning" | "issue"; notes: string };
    tests: { status: "pass" | "warning" | "issue"; notes: string };
    security: { status: "pass" | "warning" | "issue"; notes: string };
    performance: { status: "pass" | "warning" | "issue"; notes: string };
  };

  issuesFound: string[];
  suggestions: string[];

  verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  verdictExplanation: string;

  businessImpact?: string;
  riskLevel?: "low" | "medium" | "high";
  riskFactors?: string[];
  affectedAreas?: string[];
}

export interface SlideGenerationResult {
  presentationId: string;
  presentationUrl: string;
}
