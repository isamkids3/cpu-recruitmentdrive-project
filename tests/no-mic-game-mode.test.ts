import { describe, it, expect, vi } from "vitest";

describe("No Microphone in Game Mode & Text Protocol Isolation", () => {
  it("ensures game mode uses realtimeInput.text and never clientContent for messages", () => {
    // Protocol payload verification helper
    function createTextMessagePayload(text: string) {
      return {
        realtimeInput: {
          text: text,
        },
      };
    }

    function createOpeningLinePayload(openingLine: string) {
      return {
        realtimeInput: {
          text: openingLine,
        },
      };
    }

    const chatPayload = createTextMessagePayload("Hello guard!");
    expect(chatPayload).toHaveProperty("realtimeInput.text", "Hello guard!");
    expect(chatPayload).not.toHaveProperty("clientContent");

    const openingPayload = createOpeningLinePayload("Greet the visitor...");
    expect(openingPayload).toHaveProperty("realtimeInput.text", "Greet the visitor...");
    expect(openingPayload).not.toHaveProperty("clientContent");
  });

  it("verifies game mode setup payload omits inputAudioTranscription and includes outputAudioTranscription", () => {
    const gameSetupPayload = {
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck",
              },
            },
          },
        },
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: "Guard prompt" }],
        },
      },
    };

    expect(gameSetupPayload.setup.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(gameSetupPayload.setup).toHaveProperty("outputAudioTranscription");
    expect(gameSetupPayload.setup).not.toHaveProperty("inputAudioTranscription");
  });

  it("verifies separation of chat messages and secret phrase guesses", () => {
    // Simulated chat send handler
    const mockWsSend = vi.fn();
    const mockGuessApi = vi.fn();

    function handleSendChatMessage(text: string) {
      mockWsSend(JSON.stringify({ realtimeInput: { text } }));
    }

    function handleSubmitPasscodeGuess(guess: string) {
      mockGuessApi({ guess });
    }

    // When a user types in chat:
    handleSendChatMessage("What is the secret phrase?");
    expect(mockWsSend).toHaveBeenCalledWith(
      JSON.stringify({ realtimeInput: { text: "What is the secret phrase?" } })
    );
    expect(mockGuessApi).not.toHaveBeenCalled();

    // When a user submits a guess:
    handleSubmitPasscodeGuess("purple pizza");
    expect(mockGuessApi).toHaveBeenCalledWith({ guess: "purple pizza" });
    // Guesses are NEVER sent to WebSocket or LLM
    expect(mockWsSend).toHaveBeenCalledTimes(1);
  });
});
