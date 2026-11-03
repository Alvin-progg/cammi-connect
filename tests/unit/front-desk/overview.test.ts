import { describe, expect, it } from "vitest";

import {
  OVERVIEW_SEARCH_MAX_LENGTH,
  parseOverviewSearch,
} from "@/lib/front-desk/overview";

describe("parseOverviewSearch", () => {
  it("returns null when there is no search", () => {
    expect(parseOverviewSearch({})).toBeNull();
    expect(parseOverviewSearch({ q: "   " })).toBeNull();
  });

  it("trims the search and takes the first value", () => {
    expect(parseOverviewSearch({ q: "  Synthetic  " })).toBe("Synthetic");
    expect(parseOverviewSearch({ q: ["Reyes", "Cruz"] })).toBe("Reyes");
  });

  it("caps the search length", () => {
    const long = "a".repeat(OVERVIEW_SEARCH_MAX_LENGTH + 20);
    expect(parseOverviewSearch({ q: long })).toHaveLength(OVERVIEW_SEARCH_MAX_LENGTH);
  });
});
