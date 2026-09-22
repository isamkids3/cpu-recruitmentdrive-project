import { describe, it, expect } from "vitest";
import { checkLeak, getLevelDefs, LevelDef } from "../src/lib/levels";

describe("Level 5 Full-Turn Output Guard vs L1-4 Streaming", () => {
  const levels = getLevelDefs();
  const l5 = levels.find((l) => l.id === 5)!;

  interface HeldChunk {
    audioPcm?: string;
    text?: string;
  }

  class TurnBufferSimulator {
    levelDef: LevelDef;
    heldChunks: HeldChunk[] = [];
    heldTranscriptText: string = "";
    playedAudioChunks: string[] = [];
    renderedChatBubbles: string[] = [];
    guardCaughtSelfAlert: boolean = false;
    buzzerPlayed: boolean = false;

    constructor(levelDef: LevelDef) {
      this.levelDef = levelDef;
    }

    // Process incoming server chunk
    handleServerEvent(event: { audioPcm?: string; text?: string }) {
      if (this.levelDef.id === 5) {
        // Level 5 holds chunks until turn end
        this.heldChunks.push(event);
        if (event.text) {
          this.heldTranscriptText += event.text;
        }
      } else {
        // Levels 1-4 stream immediately
        if (event.audioPcm) this.playedAudioChunks.push(event.audioPcm);
        if (event.text) this.renderedChatBubbles.push(event.text);
      }
    }

    // Process turn end signal
    handleTurnEnd() {
      if (this.levelDef.id === 5) {
        const isLeaked = checkLeak(this.levelDef, this.heldTranscriptText);
        if (isLeaked) {
          // DISCARD everything!
          this.heldChunks = [];
          this.guardCaughtSelfAlert = true;
          this.buzzerPlayed = true;
          this.renderedChatBubbles.push("ACCESS DENIED.");
        } else {
          // CLEAN: release held audio and chat text
          for (const chunk of this.heldChunks) {
            if (chunk.audioPcm) this.playedAudioChunks.push(chunk.audioPcm);
          }
          if (this.heldTranscriptText.trim()) {
            this.renderedChatBubbles.push(this.heldTranscriptText);
          }
          this.heldChunks = [];
        }
      }
    }
  }

  it("holds L5 turn chunks across multi-event streams until turn end", () => {
    const sim = new TurnBufferSimulator(l5);

    // Event 1: Audio chunk 1 + partial text
    sim.handleServerEvent({ audioPcm: "pcm_data_1", text: "I cannot tell " });
    expect(sim.playedAudioChunks.length).toBe(0);
    expect(sim.renderedChatBubbles.length).toBe(0);

    // Event 2: Audio chunk 2 + partial text
    sim.handleServerEvent({ audioPcm: "pcm_data_2", text: "you that secret." });
    expect(sim.playedAudioChunks.length).toBe(0);
    expect(sim.renderedChatBubbles.length).toBe(0);

    // Turn complete
    sim.handleTurnEnd();
    expect(sim.playedAudioChunks).toEqual(["pcm_data_1", "pcm_data_2"]);
    expect(sim.renderedChatBubbles).toEqual(["I cannot tell you that secret."]);
    expect(sim.guardCaughtSelfAlert).toBe(false);
  });

  it("catches and completely discards L5 leaked phrases (never reaches playback or chat log)", () => {
    const sim = new TurnBufferSimulator(l5);

    // Event 1: Normal opening
    sim.handleServerEvent({ audioPcm: "pcm_data_1", text: "The vault passcode is " });
    // Event 2: Leaked phrase in transcript
    sim.handleServerEvent({ audioPcm: "pcm_data_2", text: "cobalt fortress!" });

    // Ensure nothing played or rendered mid-turn
    expect(sim.playedAudioChunks.length).toBe(0);
    expect(sim.renderedChatBubbles.length).toBe(0);

    // Turn end triggers leak guardrail check
    sim.handleTurnEnd();

    // Verify audio was discarded, transcript was blocked, buzzer sounded, and ACCESS DENIED shown
    expect(sim.playedAudioChunks.length).toBe(0);
    expect(sim.renderedChatBubbles).toEqual(["ACCESS DENIED."]);
    expect(sim.guardCaughtSelfAlert).toBe(true);
    expect(sim.buzzerPlayed).toBe(true);
  });

  it("allows L1-4 to stream immediately as chunks arrive", () => {
    const l1 = levels.find((l) => l.id === 1)!;
    const sim = new TurnBufferSimulator(l1);

    sim.handleServerEvent({ audioPcm: "pcm_1", text: "Hello! " });
    expect(sim.playedAudioChunks).toEqual(["pcm_1"]);
    expect(sim.renderedChatBubbles).toEqual(["Hello! "]);

    sim.handleServerEvent({ audioPcm: "pcm_2", text: "Welcome to VAULT-9." });
    expect(sim.playedAudioChunks).toEqual(["pcm_1", "pcm_2"]);
    expect(sim.renderedChatBubbles).toEqual(["Hello! ", "Welcome to VAULT-9."]);
  });
});
