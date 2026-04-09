import { describe, it, expect } from "vitest";
import { extractLeadData } from "../lead-extractor";
import type { DM, CandidateLead } from "../../types";

function makeDM(overrides: Partial<DM> = {}): DM {
  return {
    id: "dm-test-001",
    platform: "facebook",
    timestamp: "2024-06-01T09:00:00Z",
    senderName: "Jane Smith",
    senderHandle: "@janesmith",
    content: "Hi, I'm interested in your properties.",
    status: "new",
    ...overrides,
  };
}

describe("extractLeadData", () => {
  describe("name extraction", () => {
    it("extracts name from DM senderName field", () => {
      const dm = makeDM({ senderName: "Sarah Jones" });
      const lead = extractLeadData(dm);
      expect(lead.name).toBe("Sarah Jones");
    });

    it("falls back to senderHandle when senderName is empty", () => {
      const dm = makeDM({ senderName: "", senderHandle: "@fallbackuser" });
      const lead = extractLeadData(dm);
      expect(lead.name).toBe("fallbackuser");
    });

    it("extracts name from content when senderName starts with @", () => {
      const dm = makeDM({
        senderName: "@handleonly",
        senderHandle: "@handleonly",
        content: "My name is Alex Turner and I want to buy a home.",
      });
      const lead = extractLeadData(dm);
      expect(lead.name).toBe("Alex Turner");
    });

    it("returns Unknown when no name information is available", () => {
      const dm = makeDM({
        senderName: "",
        senderHandle: "",
        content: "Tell me about properties.",
      });
      const lead = extractLeadData(dm);
      expect(lead.name).toBe("Unknown");
    });
  });

  describe("contact extraction", () => {
    it("extracts email address from DM content", () => {
      const dm = makeDM({
        content: "Please send details to john.doe@example.com thanks!",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("john.doe@example.com");
    });

    it("extracts Australian phone number from DM content", () => {
      const dm = makeDM({
        content: "Call me on 0412 345 678 please.",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("0412345678");
    });

    it("extracts phone number with +61 prefix", () => {
      const dm = makeDM({
        content: "My number is +61 412 345 678.",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("+61412345678");
    });

    it("falls back to senderHandle when no contact info in content", () => {
      const dm = makeDM({
        senderHandle: "@fallbackhandle",
        content: "I want to know about Willowdale.",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("@fallbackhandle");
    });
  });

  describe("budget extraction", () => {
    it("extracts dollar amount with $ sign", () => {
      const dm = makeDM({
        content: "My budget is $750,000 for a family home.",
      });
      const lead = extractLeadData(dm);
      expect(lead.budget).toBe("750000");
    });

    it("extracts budget in K format", () => {
      const dm = makeDM({
        content: "Looking for something around 500k.",
      });
      const lead = extractLeadData(dm);
      expect(lead.budget).toBe("500000");
    });

    it("extracts budget with uppercase K", () => {
      const dm = makeDM({
        content: "Budget is about 650K.",
      });
      const lead = extractLeadData(dm);
      expect(lead.budget).toBe("650000");
    });

    it("returns null budget when no amount is mentioned", () => {
      const dm = makeDM({
        content: "I want to learn more about your communities.",
      });
      const lead = extractLeadData(dm);
      expect(lead.budget).toBeNull();
    });
  });

  describe("location extraction", () => {
    it("identifies known community name Elara", () => {
      const dm = makeDM({
        content: "I'm interested in the Elara community.",
      });
      const lead = extractLeadData(dm);
      expect(lead.location).toBe("Elara");
    });

    it("identifies known location Leppington", () => {
      const dm = makeDM({
        content: "Do you have anything available in Leppington?",
      });
      const lead = extractLeadData(dm);
      expect(lead.location).toBe("Leppington");
    });

    it("identifies Sydney as a location", () => {
      const dm = makeDM({
        content: "We are looking for a home in Sydney.",
      });
      const lead = extractLeadData(dm);
      expect(lead.location).toBe("Sydney");
    });

    it("returns null location when no known location is mentioned", () => {
      const dm = makeDM({
        content: "I want to buy a house somewhere nice.",
      });
      const lead = extractLeadData(dm);
      expect(lead.location).toBeNull();
    });

    it("matches location case-insensitively", () => {
      const dm = makeDM({
        content: "What's available in marsden park?",
      });
      const lead = extractLeadData(dm);
      expect(lead.location).toBe("Marsden Park");
    });
  });

  describe("intent classification", () => {
    it("classifies buying intent", () => {
      const dm = makeDM({
        content: "I'm looking to buy a 3-bedroom home for my family.",
      });
      const lead = extractLeadData(dm);
      expect(lead.intent.toLowerCase()).toContain("purchasing");
    });

    it("classifies tour/inspection intent", () => {
      const dm = makeDM({
        content: "Can I book a tour of the display homes this weekend?",
      });
      const lead = extractLeadData(dm);
      expect(lead.intent.toLowerCase()).toContain("tour");
    });

    it("classifies rental intent", () => {
      const dm = makeDM({
        content: "I'm looking to rent a 2-bedroom apartment.",
      });
      const lead = extractLeadData(dm);
      expect(lead.intent.toLowerCase()).toContain("renting");
    });

    it("classifies information request intent", () => {
      const dm = makeDM({
        content: "Can you send me a brochure with pricing details?",
      });
      const lead = extractLeadData(dm);
      expect(lead.intent.toLowerCase()).toContain("information");
    });

    it("returns general inquiry for vague messages", () => {
      const dm = makeDM({
        content: "Hello there!",
      });
      const lead = extractLeadData(dm);
      expect(lead.intent.toLowerCase()).toContain("general inquiry");
    });
  });

  describe("priority classification", () => {
    it("assigns high priority for buying intent with budget", () => {
      const dm = makeDM({
        senderName: "John Buyer",
        content:
          "I want to buy a home in Elara. My budget is $750,000. Please contact me at john@example.com.",
      });
      const lead = extractLeadData(dm);
      expect(lead.priority).toBe("high");
    });

    it("assigns high priority for tour request with budget", () => {
      const dm = makeDM({
        senderName: "Tour Person",
        content:
          "I'd like to book a tour of display homes. Budget around $500,000. Email me at tour@test.com.",
      });
      const lead = extractLeadData(dm);
      expect(lead.priority).toBe("high");
    });

    it("assigns low priority for vague messages with no details", () => {
      const dm = makeDM({
        senderName: "",
        senderHandle: "@random",
        content: "Hey, just browsing.",
      });
      const lead = extractLeadData(dm);
      expect(lead.priority).toBe("low");
    });
  });

  describe("output structure", () => {
    it("returns a CandidateLead with all required fields", () => {
      const dm = makeDM({
        id: "dm-struct-001",
        content: "I want to buy a home in Sydney for $600,000. Email: test@test.com",
      });
      const lead = extractLeadData(dm);

      expect(lead).toHaveProperty("dmId", "dm-struct-001");
      expect(lead).toHaveProperty("name");
      expect(lead).toHaveProperty("contact");
      expect(lead).toHaveProperty("budget");
      expect(lead).toHaveProperty("location");
      expect(lead).toHaveProperty("intent");
      expect(lead).toHaveProperty("priority");
    });

    it("sets dmId to the DM id", () => {
      const dm = makeDM({ id: "dm-ref-123" });
      const lead = extractLeadData(dm);
      expect(lead.dmId).toBe("dm-ref-123");
    });
  });

  describe("edge cases", () => {
    it("handles empty content gracefully", () => {
      const dm = makeDM({ content: "" });
      const lead = extractLeadData(dm);
      expect(lead).toBeDefined();
      expect(lead.dmId).toBe(dm.id);
      expect(lead.budget).toBeNull();
      expect(lead.location).toBeNull();
    });

    it("handles content with only whitespace", () => {
      const dm = makeDM({ content: "   " });
      const lead = extractLeadData(dm);
      expect(lead).toBeDefined();
      expect(lead.intent.toLowerCase()).toContain("general inquiry");
    });

    it("handles content with special characters", () => {
      const dm = makeDM({
        content: "Hi!!! I'm interested in buying @ Elara??? Budget: $500,000!!!",
      });
      const lead = extractLeadData(dm);
      expect(lead).toBeDefined();
      expect(lead.budget).toBe("500000");
      expect(lead.location).toBe("Elara");
    });

    it("handles multiple emails and picks the first one", () => {
      const dm = makeDM({
        content: "Email me at first@example.com or second@example.com.",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("first@example.com");
    });

    it("prefers email over phone when both are present", () => {
      const dm = makeDM({
        content: "Reach me at hello@test.com or 0412 345 678.",
      });
      const lead = extractLeadData(dm);
      expect(lead.contact).toBe("hello@test.com");
    });

    it("handles very long content without errors", () => {
      const longContent = "I want to buy a home. ".repeat(500) + "Budget $800,000. Location: Melbourne.";
      const dm = makeDM({ content: longContent });
      const lead = extractLeadData(dm);
      expect(lead).toBeDefined();
      expect(lead.budget).toBe("800000");
      expect(lead.location).toBe("Melbourne");
    });
  });
});