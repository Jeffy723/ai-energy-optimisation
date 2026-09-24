import { describe, expect, it, vi } from "vitest";
import { runDemo } from "../src/demo.js";

describe("command-line demonstration", () => {
  it("executes the complete example pipeline", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(runDemo()).resolves.toBeUndefined();
    expect(output.mock.calls.some(([line]) =>
      typeof line === "string" &&
      line.includes("AI ENERGY OPTIMISATION DEMONSTRATION"),
    )).toBe(true);
    expect(output.mock.calls.some(([line]) =>
      typeof line === "string" &&
      line.includes("Local optimum"),
    )).toBe(true);
    output.mockRestore();
  });
});
