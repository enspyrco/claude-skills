import { google, slides_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { ReviewData, SlideGenerationResult } from "./types.js";
import {
  COLORS,
  getStatusEmoji,
  getRiskColor,
  getVerdictColor,
} from "./templates.js";

export async function generateSlides(
  auth: OAuth2Client,
  reviewData: ReviewData
): Promise<SlideGenerationResult> {
  const slides = google.slides({ version: "v1", auth });

  // Create the presentation
  const presentation = await slides.presentations.create({
    requestBody: {
      title: `PR Review: ${reviewData.prTitle}`,
    },
  });

  const presentationId = presentation.data.presentationId!;

  // Delete the default blank slide and create our slides
  const defaultSlideId = presentation.data.slides![0].objectId!;

  const slideIds = {
    title: `title_${Date.now()}`,
    summary: `summary_${Date.now()}`,
    impact: `impact_${Date.now()}`,
    risks: `risks_${Date.now()}`,
    verdict: `verdict_${Date.now()}`,
  };

  // Create slides with TITLE_AND_BODY layout
  const createRequests: slides_v1.Schema$Request[] = [
    { deleteObject: { objectId: defaultSlideId } },
    ...Object.values(slideIds).map((id) => ({
      createSlide: {
        objectId: id,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" as const },
      },
    })),
  ];

  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests: createRequests },
  });

  // Get the created slides to find placeholder IDs
  const updatedPresentation = await slides.presentations.get({
    presentationId,
  });

  const contentRequests: slides_v1.Schema$Request[] = [];

  for (const slide of updatedPresentation.data.slides || []) {
    const slideId = slide.objectId!;
    const placeholders = slide.pageElements?.filter(
      (el) => el.shape?.placeholder
    );

    const titlePlaceholder = placeholders?.find(
      (el) => el.shape?.placeholder?.type === "TITLE"
    );
    const bodyPlaceholder = placeholders?.find(
      (el) => el.shape?.placeholder?.type === "BODY"
    );

    const titleId = titlePlaceholder?.objectId ?? undefined;
    const bodyId = bodyPlaceholder?.objectId ?? undefined;

    if (slideId === slideIds.title) {
      contentRequests.push(...buildTitleContent(titleId, bodyId, reviewData));
    } else if (slideId === slideIds.summary) {
      contentRequests.push(...buildSummaryContent(titleId, bodyId, reviewData));
    } else if (slideId === slideIds.impact) {
      contentRequests.push(...buildImpactContent(titleId, bodyId, reviewData));
    } else if (slideId === slideIds.risks) {
      contentRequests.push(...buildRisksContent(titleId, bodyId, reviewData));
    } else if (slideId === slideIds.verdict) {
      contentRequests.push(...buildVerdictContent(titleId, bodyId, reviewData));
    }
  }

  if (contentRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: contentRequests },
    });
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

function buildTitleContent(
  titleId: string | undefined,
  bodyId: string | undefined,
  data: ReviewData
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  if (titleId) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: data.prTitle,
        insertionIndex: 0,
      },
    });
  }

  if (bodyId) {
    const subtitle = `PR #${data.prNumber} | ${data.repository}\n${data.prAuthor} | ${formatDate(data.prDate)}`;
    requests.push({
      insertText: {
        objectId: bodyId,
        text: subtitle,
        insertionIndex: 0,
      },
    });
  }

  return requests;
}

function buildSummaryContent(
  titleId: string | undefined,
  bodyId: string | undefined,
  data: ReviewData
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  if (titleId) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: "What Changed",
        insertionIndex: 0,
      },
    });
  }

  if (bodyId) {
    const lines = [data.summary, "", ...data.changes.map((c) => `- ${c}`)];
    requests.push({
      insertText: {
        objectId: bodyId,
        text: lines.join("\n"),
        insertionIndex: 0,
      },
    });
  }

  return requests;
}

function buildImpactContent(
  titleId: string | undefined,
  bodyId: string | undefined,
  data: ReviewData
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  if (titleId) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: "Impact Assessment",
        insertionIndex: 0,
      },
    });
  }

  if (bodyId) {
    const lines: string[] = [];

    if (data.businessImpact) {
      lines.push("Business Impact:", data.businessImpact, "");
    }

    if (data.affectedAreas && data.affectedAreas.length > 0) {
      lines.push("Affected Areas:");
      lines.push(...data.affectedAreas.map((a) => `- ${a}`));
      lines.push("");
    }

    lines.push("Quality Summary:");
    const qa = data.qualityAssessment;
    lines.push(`- Code Quality: ${getStatusEmoji(qa.codeQuality.status)}`);
    lines.push(`- Tests: ${getStatusEmoji(qa.tests.status)}`);
    lines.push(`- Security: ${getStatusEmoji(qa.security.status)}`);
    lines.push(`- Performance: ${getStatusEmoji(qa.performance.status)}`);

    requests.push({
      insertText: {
        objectId: bodyId,
        text: lines.join("\n"),
        insertionIndex: 0,
      },
    });
  }

  return requests;
}

function buildRisksContent(
  titleId: string | undefined,
  bodyId: string | undefined,
  data: ReviewData
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  if (titleId) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: "Risk Assessment",
        insertionIndex: 0,
      },
    });
  }

  if (bodyId) {
    const lines: string[] = [];

    const riskLevel = data.riskLevel || "low";
    lines.push(`Risk Level: ${riskLevel.toUpperCase()}`, "");

    if (data.riskFactors && data.riskFactors.length > 0) {
      lines.push("Risk Factors:");
      lines.push(...data.riskFactors.map((r) => `- ${r}`));
      lines.push("");
    }

    if (data.issuesFound && data.issuesFound.length > 0) {
      lines.push("Issues Found:");
      lines.push(...data.issuesFound.map((i) => `- ${i}`));
    } else {
      lines.push("No blocking issues found.");
    }

    requests.push({
      insertText: {
        objectId: bodyId,
        text: lines.join("\n"),
        insertionIndex: 0,
      },
    });
  }

  return requests;
}

function buildVerdictContent(
  titleId: string | undefined,
  bodyId: string | undefined,
  data: ReviewData
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  if (titleId) {
    requests.push({
      insertText: {
        objectId: titleId,
        text: `Recommendation: ${data.verdict}`,
        insertionIndex: 0,
      },
    });
  }

  if (bodyId) {
    const lines: string[] = [data.verdictExplanation, ""];

    if (data.suggestions && data.suggestions.length > 0) {
      lines.push("Suggestions:");
      lines.push(...data.suggestions.map((s) => `- ${s}`));
    }

    requests.push({
      insertText: {
        objectId: bodyId,
        text: lines.join("\n"),
        insertionIndex: 0,
      },
    });
  }

  return requests;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
