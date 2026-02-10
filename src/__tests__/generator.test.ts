import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis before importing generator
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockBatchUpdate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    slides: () => ({
      presentations: {
        get: mockGet,
        create: mockCreate,
        batchUpdate: mockBatchUpdate,
      },
    }),
  },
}));

import { generateSlidesFromConfig, generateSlides } from "../slides/generator.js";
import type { SlideConfig, ReviewData } from "../slides/types.js";

function makeSlide(
  objectId: string,
  pageElements: { objectId: string }[] = []
) {
  return {
    objectId,
    pageElements,
    slideProperties: {
      notesPage: {
        notesProperties: { speakerNotesObjectId: `${objectId}_notes` },
      },
    },
  };
}

function makeLegacySlide(objectId: string, titleId: string, bodyId: string) {
  return {
    objectId,
    pageElements: [
      { objectId: titleId, shape: { placeholder: { type: "TITLE" } } },
      { objectId: bodyId, shape: { placeholder: { type: "BODY" } } },
    ],
  };
}

function getAllRequests(): unknown[] {
  return mockBatchUpdate.mock.calls.flatMap(
    (call: unknown[]) =>
      (call[0] as { requestBody: { requests: unknown[] } }).requestBody
        .requests
  );
}

function getLastRequests(): unknown[] {
  const lastCall =
    mockBatchUpdate.mock.calls[mockBatchUpdate.mock.calls.length - 1];
  return (lastCall[0] as { requestBody: { requests: unknown[] } }).requestBody
    .requests;
}

const fakeAuth = {} as Parameters<typeof generateSlidesFromConfig>[0];

const baseConfig: SlideConfig = {
  title: "Test",
  slides: [
    {
      background: "darkBlue",
      elements: [
        { text: "Hello", x: 50, y: 50, w: 600, h: 60, size: 28, color: "white" },
      ],
      notes: "Speaker note",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBatchUpdate.mockResolvedValue({});
});

// ─── Append mode ────────────────────────────────────────────────────────────

describe("append mode", () => {
  it("inserts slides after existing ones", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("existing1"), makeSlide("existing2")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      append: true,
    });

    const reqs = getAllRequests();
    const createSlide = reqs.find(
      (r: unknown) => (r as { createSlide?: unknown }).createSlide
    ) as { createSlide: { insertionIndex: number } };
    expect(createSlide.createSlide.insertionIndex).toBe(2);
  });

  it("does not delete existing slides", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("existing1")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      append: true,
    });

    const reqs = getAllRequests();
    const deletes = reqs.filter(
      (r: unknown) => (r as { deleteObject?: unknown }).deleteObject
    );
    expect(deletes).toHaveLength(0);
  });

  it("offsets speaker notes to match appended slides", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { slides: [makeSlide("existing1")] },
      })
      .mockResolvedValueOnce({
        data: { slides: [makeSlide("existing1"), makeSlide("new1")] },
      });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      append: true,
    });

    const reqs = getAllRequests();
    const insertTexts = reqs.filter(
      (r: unknown) => {
        const it = (r as { insertText?: { objectId: string } }).insertText;
        return it && it.objectId?.endsWith("_notes");
      }
    );
    expect(insertTexts).toHaveLength(1);
    expect(
      (insertTexts[0] as { insertText: { objectId: string } }).insertText.objectId
    ).toBe("new1_notes");
  });

  it("handles append to empty presentation", async () => {
    mockGet
      .mockResolvedValueOnce({ data: { slides: [] } })
      .mockResolvedValueOnce({ data: { slides: [makeSlide("new1")] } });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      append: true,
    });

    const reqs = getAllRequests();
    const createSlide = reqs.find(
      (r: unknown) => (r as { createSlide?: unknown }).createSlide
    ) as { createSlide: { insertionIndex: number } };
    expect(createSlide.createSlide.insertionIndex).toBe(0);
  });
});

// ─── Replace mode ───────────────────────────────────────────────────────────

describe("replace mode", () => {
  it("deletes existing slides before creating new ones", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { slides: [makeSlide("old1"), makeSlide("old2")] },
      })
      .mockResolvedValueOnce({
        data: { slides: [makeSlide("new1")] },
      });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
    });

    const firstBatch = mockBatchUpdate.mock.calls[0][0].requestBody.requests;
    const deletes = firstBatch.filter(
      (r: unknown) => (r as { deleteObject?: unknown }).deleteObject
    );
    expect(deletes).toHaveLength(2);
  });

  it("handles replace on empty presentation", async () => {
    mockGet
      .mockResolvedValueOnce({ data: { slides: [] } })
      .mockResolvedValueOnce({ data: { slides: [makeSlide("new1")] } });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
    });

    // First batchUpdate should be the new slide creation, not deletion
    const firstBatch = mockBatchUpdate.mock.calls[0][0].requestBody.requests;
    const hasCreate = firstBatch.some(
      (r: unknown) => (r as { createSlide?: unknown }).createSlide
    );
    expect(hasCreate).toBe(true);
  });
});

// ─── New presentation ───────────────────────────────────────────────────────

describe("new presentation", () => {
  it("creates presentation and deletes default slide", async () => {
    mockCreate.mockResolvedValue({
      data: {
        presentationId: "new_pres",
        slides: [{ objectId: "default_slide" }],
      },
    });
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide1")] },
    });

    const result = await generateSlidesFromConfig(fakeAuth, baseConfig);

    expect(result.presentationId).toBe("new_pres");
    expect(mockCreate).toHaveBeenCalled();
    // First batchUpdate deletes the default slide
    const firstReqs = mockBatchUpdate.mock.calls[0][0].requestBody.requests;
    expect(firstReqs[0].deleteObject.objectId).toBe("default_slide");
  });
});

// ─── Content generation ─────────────────────────────────────────────────────

describe("content generation", () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({
      data: {
        presentationId: "pres",
        slides: [{ objectId: "default" }],
      },
    });
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("s1")] },
    });
  });

  it("creates text boxes with correct EMU positioning", async () => {
    await generateSlidesFromConfig(fakeAuth, baseConfig);
    const reqs = getAllRequests();
    const createShape = reqs.find(
      (r: unknown) => (r as { createShape?: unknown }).createShape
    ) as { createShape: { elementProperties: { transform: { translateX: number; translateY: number } } } };
    // 50 * 12700 = 635000
    expect(createShape.createShape.elementProperties.transform.translateX).toBe(635000);
    expect(createShape.createShape.elementProperties.transform.translateY).toBe(635000);
  });

  it("sets background color", async () => {
    await generateSlidesFromConfig(fakeAuth, baseConfig);
    const reqs = getAllRequests();
    const bgReq = reqs.find(
      (r: unknown) => (r as { updatePageProperties?: unknown }).updatePageProperties
    );
    expect(bgReq).toBeDefined();
  });

  it("applies bold text style", async () => {
    const config: SlideConfig = {
      title: "Test",
      slides: [
        {
          elements: [
            { text: "Bold", x: 0, y: 0, w: 100, h: 50, size: 20, color: "white", bold: true },
          ],
        },
      ],
    };
    mockCreate.mockResolvedValue({
      data: { presentationId: "pres", slides: [{ objectId: "def" }] },
    });
    mockGet.mockResolvedValue({ data: { slides: [makeSlide("s")] } });

    await generateSlidesFromConfig(fakeAuth, config);
    const reqs = getAllRequests();
    const textStyle = reqs.find(
      (r: unknown) => (r as { updateTextStyle?: unknown }).updateTextStyle
    ) as { updateTextStyle: { style: { bold: boolean } } };
    expect(textStyle.updateTextStyle.style.bold).toBe(true);
  });

  it("resolves theme colors", async () => {
    const config: SlideConfig = {
      title: "Test",
      theme: { colors: { brand: { red: 0.5, green: 0.6, blue: 0.7 } } },
      slides: [
        {
          elements: [
            { text: "Themed", x: 0, y: 0, w: 100, h: 50, size: 20, color: "brand" },
          ],
        },
      ],
    };
    await generateSlidesFromConfig(fakeAuth, config);
    const reqs = getAllRequests();
    const textStyle = reqs.find(
      (r: unknown) => (r as { updateTextStyle?: unknown }).updateTextStyle
    ) as { updateTextStyle: { style: { foregroundColor: { opaqueColor: { rgbColor: { red: number } } } } } };
    expect(textStyle.updateTextStyle.style.foregroundColor.opaqueColor.rgbColor.red).toBe(0.5);
  });

  it("adds speaker notes", async () => {
    await generateSlidesFromConfig(fakeAuth, baseConfig);
    const reqs = getAllRequests();
    const noteInsert = reqs.find(
      (r: unknown) => {
        const it = (r as { insertText?: { objectId: string } }).insertText;
        return it && it.objectId?.endsWith("_notes");
      }
    ) as { insertText: { text: string } };
    expect(noteInsert.insertText.text).toBe("Speaker note");
  });

  it("handles multiple elements per slide", async () => {
    const config: SlideConfig = {
      title: "Test",
      slides: [
        {
          elements: [
            { text: "One", x: 0, y: 0, w: 100, h: 50, size: 20, color: "white" },
            { text: "Two", x: 0, y: 60, w: 100, h: 50, size: 20, color: "white" },
            { text: "Three", x: 0, y: 120, w: 100, h: 50, size: 20, color: "white" },
          ],
        },
      ],
    };
    await generateSlidesFromConfig(fakeAuth, config);
    const reqs = getAllRequests();
    const createShapes = reqs.filter(
      (r: unknown) => (r as { createShape?: unknown }).createShape
    );
    expect(createShapes).toHaveLength(3);
  });
});

// ─── Update-slide mode ──────────────────────────────────────────────────────

describe("update-slide mode", () => {
  it("deletes existing elements on target slide", async () => {
    mockGet.mockResolvedValue({
      data: {
        slides: [
          makeSlide("slide0", [{ objectId: "elem1" }, { objectId: "elem2" }]),
        ],
      },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 0,
    });

    const reqs = getAllRequests();
    const deletes = reqs.filter(
      (r: unknown) => {
        const del = (r as { deleteObject?: { objectId: string } }).deleteObject;
        return del && (del.objectId === "elem1" || del.objectId === "elem2");
      }
    );
    expect(deletes).toHaveLength(2);
  });

  it("resolves 'last' to the final slide", async () => {
    mockGet.mockResolvedValue({
      data: {
        slides: [makeSlide("slide0"), makeSlide("slide1"), makeSlide("slide2")],
      },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: "last",
    });

    // Should target slide2 — check that new elements reference slide2's objectId
    const reqs = getAllRequests();
    const createShapes = reqs.filter(
      (r: unknown) => (r as { createShape?: unknown }).createShape
    ) as { createShape: { elementProperties: { pageObjectId: string } } }[];
    expect(createShapes.length).toBeGreaterThan(0);
    expect(createShapes[0].createShape.elementProperties.pageObjectId).toBe("slide2");
  });

  it("resolves numeric index correctly", async () => {
    mockGet.mockResolvedValue({
      data: {
        slides: [makeSlide("slide0"), makeSlide("slide1")],
      },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 1,
    });

    const reqs = getAllRequests();
    const createShapes = reqs.filter(
      (r: unknown) => (r as { createShape?: unknown }).createShape
    ) as { createShape: { elementProperties: { pageObjectId: string } } }[];
    expect(createShapes[0].createShape.elementProperties.pageObjectId).toBe("slide1");
  });

  it("creates new elements on the target slide", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide0")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 0,
    });

    const reqs = getAllRequests();
    const creates = reqs.filter(
      (r: unknown) => (r as { createShape?: unknown }).createShape
    );
    expect(creates.length).toBeGreaterThan(0);
  });

  it("does not emit createSlide requests", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide0")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 0,
    });

    const reqs = getAllRequests();
    const createSlides = reqs.filter(
      (r: unknown) => (r as { createSlide?: unknown }).createSlide
    );
    expect(createSlides).toHaveLength(0);
  });

  it("clears and replaces speaker notes", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide0")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 0,
    });

    const lastReqs = getLastRequests();
    const deleteText = lastReqs.find(
      (r: unknown) => (r as { deleteText?: unknown }).deleteText
    ) as { deleteText: { objectId: string; textRange: { type: string } } };
    expect(deleteText.deleteText.objectId).toBe("slide0_notes");
    expect(deleteText.deleteText.textRange.type).toBe("ALL");

    const insertText = lastReqs.find(
      (r: unknown) => {
        const it = (r as { insertText?: { objectId: string } }).insertText;
        return it && it.objectId?.endsWith("_notes");
      }
    ) as { insertText: { text: string } };
    expect(insertText.insertText.text).toBe("Speaker note");
  });

  it("throws on empty presentation", async () => {
    mockGet.mockResolvedValue({ data: { slides: [] } });

    await expect(
      generateSlidesFromConfig(fakeAuth, {
        ...baseConfig,
        presentationId: "pres1",
        updateSlide: 0,
      })
    ).rejects.toThrow("Presentation has no slides to update");
  });

  it("throws on out-of-range index", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide0")] },
    });

    await expect(
      generateSlidesFromConfig(fakeAuth, {
        ...baseConfig,
        presentationId: "pres1",
        updateSlide: 5,
      })
    ).rejects.toThrow("Slide index 5 out of range");
  });

  it("updates background on target slide", async () => {
    mockGet.mockResolvedValue({
      data: { slides: [makeSlide("slide0")] },
    });

    await generateSlidesFromConfig(fakeAuth, {
      ...baseConfig,
      presentationId: "pres1",
      updateSlide: 0,
    });

    const reqs = getAllRequests();
    const bgReq = reqs.find(
      (r: unknown) => (r as { updatePageProperties?: unknown }).updatePageProperties
    );
    expect(bgReq).toBeDefined();
  });
});

// ─── Legacy generateSlides ──────────────────────────────────────────────────

describe("legacy generateSlides", () => {
  const baseReviewData: ReviewData = {
    prNumber: 42,
    prTitle: "feat: add authentication",
    prAuthor: "dev",
    prDate: "2024-01-15T00:00:00Z",
    repository: "owner/repo",
    summary: "Added auth",
    changes: ["Added login page"],
    qualityAssessment: {
      codeQuality: { status: "pass", notes: "Good" },
      tests: { status: "pass", notes: "OK" },
      security: { status: "pass", notes: "Fine" },
      performance: { status: "pass", notes: "Fast" },
    },
    issuesFound: [],
    suggestions: ["Add more tests"],
    verdict: "APPROVE",
    verdictExplanation: "Looks good",
  };

  it("creates presentation with correct title", async () => {
    mockCreate.mockResolvedValue({
      data: {
        presentationId: "legacy_pres",
        slides: [{ objectId: "default" }],
      },
    });
    mockGet.mockResolvedValue({
      data: {
        slides: [
          makeLegacySlide("title_1", "t1", "b1"),
          makeLegacySlide("summary_1", "t2", "b2"),
          makeLegacySlide("impact_1", "t3", "b3"),
          makeLegacySlide("risks_1", "t4", "b4"),
          makeLegacySlide("verdict_1", "t5", "b5"),
        ],
      },
    });

    const result = await generateSlides(fakeAuth, baseReviewData);
    expect(result.presentationId).toBe("legacy_pres");
    expect(mockCreate).toHaveBeenCalledWith({
      requestBody: { title: "PR Review: feat: add authentication" },
    });
  });

  it("populates content on all slides", async () => {
    // Mock Date.now so slideIds are predictable
    const NOW = 1000;
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    mockCreate.mockResolvedValue({
      data: {
        presentationId: "legacy_pres",
        slides: [{ objectId: "default" }],
      },
    });
    mockGet.mockResolvedValue({
      data: {
        slides: [
          makeLegacySlide(`title_${NOW}`, "t1", "b1"),
          makeLegacySlide(`summary_${NOW}`, "t2", "b2"),
          makeLegacySlide(`impact_${NOW}`, "t3", "b3"),
          makeLegacySlide(`risks_${NOW}`, "t4", "b4"),
          makeLegacySlide(`verdict_${NOW}`, "t5", "b5"),
        ],
      },
    });

    await generateSlides(fakeAuth, baseReviewData);
    // Find the content batch (the one with insertText requests)
    const allCalls = mockBatchUpdate.mock.calls;
    const contentBatch = allCalls.find((call: unknown[]) => {
      const reqs = (call[0] as { requestBody: { requests: unknown[] } }).requestBody.requests;
      return reqs.some((r: unknown) => (r as { insertText?: unknown }).insertText);
    });
    expect(contentBatch).toBeDefined();
    const contentReqs = (contentBatch![0] as { requestBody: { requests: unknown[] } }).requestBody.requests;
    const insertTexts = contentReqs.filter(
      (r: unknown) => (r as { insertText?: unknown }).insertText
    );
    expect(insertTexts.length).toBeGreaterThanOrEqual(5);

    vi.restoreAllMocks();
  });

  it("returns correct presentation URL", async () => {
    mockCreate.mockResolvedValue({
      data: {
        presentationId: "url_test",
        slides: [{ objectId: "default" }],
      },
    });
    mockGet.mockResolvedValue({ data: { slides: [] } });

    const result = await generateSlides(fakeAuth, baseReviewData);
    expect(result.presentationUrl).toBe(
      "https://docs.google.com/presentation/d/url_test/edit"
    );
  });
});
