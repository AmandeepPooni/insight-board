import {
    mapBoardBootstrapData,
    serializeGraphqlJsonValue,
    type InsightBoardBootstrapData,
    type InsightBoardMetadataData,
} from "@/lib/services/insight-board-graphql";

describe("serializeGraphqlJsonValue", () => {
  it("serializes JSON inputs for pg_graphql mutations", () => {
    expect(
      serializeGraphqlJsonValue({
        count: 2,
        field: "impact",
      }),
    ).toBe('{"count":2,"field":"impact"}');
  });
});

describe("mapBoardBootstrapData", () => {
  it("parses user preference custom field definitions returned as JSON strings", () => {
    const data: InsightBoardMetadataData = {
      userPreferencesCollection: {
        edges: [
          {
            node: {
              id: "pref-1",
              userId: "user-1",
              customFieldDefinitions:
                '[{"key":"site","label":"Site","type":"text"}]',
            },
          },
        ],
      },
    };

    const snapshot = mapBoardBootstrapData(data, {
      email: "user@example.com",
      fullName: "Test User",
      id: "user-1",
    });

    expect(snapshot.customFieldDefinitions).toEqual([
      {
        key: "site",
        label: "Site",
        type: "text",
      },
    ]);
  });

  it("parses insight custom fields returned as JSON strings", () => {
    const data: InsightBoardBootstrapData = {
      insightsCollection: {
        edges: [
          {
            node: {
              id: "insight-1",
              title: "Dose escalation concern",
              description: "Needs follow-up",
              stage: "observation",
              priority: "P2",
              categoryId: null,
              hcpId: null,
              createdBy: "user-1",
              drugName: "Ozempic",
              customFields:
                '{"followUpDate":"2026-04-16","visitCount":3,"ignored":true}',
              columnOrder: 0,
              isArchived: false,
              createdAt: "2026-04-16T12:00:00.000Z",
              updatedAt: "2026-04-16T12:00:00.000Z",
            },
          },
        ],
      },
    };

    const snapshot = mapBoardBootstrapData(data, {
      email: "user@example.com",
      fullName: "Test User",
      id: "user-1",
    });

    expect(snapshot.insights[0]?.customFields).toEqual({
      followUpDate: "2026-04-16",
      visitCount: 3,
    });
  });
});
