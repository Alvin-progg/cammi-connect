import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom gaps that cmdk (the front desk ⌘K palette) and motion rely on.
if (typeof window !== "undefined") {
  window.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  // motion's whileInView (landing page reveals) observes elements; jsdom has
  // no IntersectionObserver, so nothing ever enters view in tests.
  window.IntersectionObserver ??= class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
