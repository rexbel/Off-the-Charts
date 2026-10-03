import { describe, expect, it } from "vitest";
import type { VideoScript } from "@/lib/schemas";
import { spotForText, spotsForScript } from "./spots";

const script: VideoScript = {
  stage: "before",
  title: "Before your visit",
  scenes: [
    { kind: "title", title: "Before your visit", text: "Hi, Emily.", voiceover: "Hi Emily." },
    { kind: "card", title: "When and where", text: "Monday, October 5 · 1:30 pm", voiceover: "Your visit is Monday at 1:30." },
    { kind: "steps", title: "What will happen", text: "", items: ["Arrive 10 minutes early.", "We'll check your blood pressure.", "Then an echo of your heart."], voiceover: "Arrive early. We check your blood pressure. Then an echo." },
    { kind: "choice", title: "Your choice", text: "You can…", items: ["Bring someone", "Ask for a break"], voiceover: "You can bring someone or ask for a break." },
    { kind: "closing", title: "We're here", text: "Text or call us at 555-0100.", voiceover: "Text us any time." },
  ],
};

describe("spot matching", () => {
  it("picks one picture per idea and never repeats a picture in consecutive scenes", () => {
    const spots = spotsForScript(script);
    expect(spots[0].scene).toBeNull(); // title scenes use the character backdrop
    expect(spots[1].scene).toBe("calendar");
    expect(spots[2].items).toEqual(["arrive", "vitals", "heart_scan"]);
    expect(spots[4].scene).toBe("phone_call");
    for (let i = 1; i < spots.length; i += 1) if (spots[i].scene && spots[i - 1].scene) expect(spots[i].scene).not.toBe(spots[i - 1].scene);
  });

  it("keeps the phone call for the closing scene even when an earlier scene mentions calling", () => {
    const spots = spotsForScript({
      stage: "after",
      title: "After your visit",
      scenes: [
        { kind: "title", title: "Thank you", text: "Thank you for coming.", voiceover: "Thank you." },
        { kind: "choice", title: "When to call", text: "Call if you have a fever.", items: ["Call if you have a fever", "Call 555-0100 if you are worried"], voiceover: "Call us if you have a fever." },
        { kind: "closing", title: "We're here", text: "Call 555-0100 for help anytime.", voiceover: "Call us any time." },
      ],
    });
    expect(spots[1].scene).not.toBe("phone_call");
    expect(spots[2].scene).toBe("phone_call");
  });

  it("understands Spanish", () => {
    expect(spotForText("Le tomaremos la presión.")).toBe("vitals");
    expect(spotForText("Siga tomando sus medicinas igual.")).toBe("medicines");
    expect(spotForText("Escríbanos o llame al 555-0100")).toBe("phone_call");
  });

  it("falls back to a conversation with the care team", () => {
    expect(spotForText("Something unrelated")).toBe("talk_team");
  });
});
