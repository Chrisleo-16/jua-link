import { describe, expect, it } from "vitest";
import { parseArtisanReply, parseArtisanReplyInput } from "@/lib/types";

describe("parseArtisanReplyInput", () => {
  it("parses command-only replies", () => {
    expect(parseArtisanReplyInput("1")).toEqual({
      response: "accepted",
      orderReference: null,
    });
    expect(parseArtisanReplyInput("decline")).toEqual({
      response: "declined",
      orderReference: null,
    });
    expect(parseArtisanReplyInput("CALLBACK")).toEqual({
      response: "callback_requested",
      orderReference: null,
    });
  });

  it("parses replies that include order references", () => {
    expect(parseArtisanReplyInput("JL-2048 1")).toEqual({
      response: "accepted",
      orderReference: "JL-2048",
    });
    expect(parseArtisanReplyInput("accept jl-9999")).toEqual({
      response: "accepted",
      orderReference: "JL-9999",
    });
    expect(parseArtisanReplyInput("jl-1001 3")).toEqual({
      response: "callback_requested",
      orderReference: "JL-1001",
    });
  });

  it("returns null for unrecognized replies", () => {
    expect(parseArtisanReplyInput("maybe")).toBeNull();
    expect(parseArtisanReplyInput("JL-2048 maybe")).toBeNull();
  });
});

describe("parseArtisanReply", () => {
  it("keeps compatibility for simple command replies", () => {
    expect(parseArtisanReply("1")).toBe("accepted");
    expect(parseArtisanReply("2")).toBe("declined");
    expect(parseArtisanReply("3")).toBe("callback_requested");
  });
});
