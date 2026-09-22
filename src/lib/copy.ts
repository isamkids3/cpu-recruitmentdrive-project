/**
 * Centralized visitor-facing copy dictionary.
 * Rule: Banned in visitor UI strings: prompt injection, honeytoken, jailbreak,
 * system prompt, passphrase, red team, attack, breach.
 * Technical terms are ONLY allowed in lesson card "Real name" badges, hint text, and staff-only screens.
 */

export interface LessonContent {
  plain: string;
  technicalName: string;
  decoyVariant?: string;
}

export const GAME_COPY = {
  title: "Crack the Vault",
  tagline: "Can you get the robot guard to give up its secret phrase?",
  subtitle: "Takes 2 minutes. No experience needed.",
  steps: {
    step1: "1. Chat with the guard.",
    step2: "2. Convince it to tell you the secret phrase.",
    step3: "3. Type the phrase in the phrase box to win!",
  },
  startButton: "START CHALLENGE",
  chatPanelTitle: "CHAT WITH THE GUARD",
  phraseBoxTitle: "Think you know the secret phrase? Type it here",
  leakFlash: "😮 The AI slipped up!",
  leakBubbleTag: "👀 Listen closely",
  cutLine: "🤐 The AI caught itself!",
  guardThinking: "The guard is thinking...",
  accessDeniedBubble: "ACCESS DENIED.",
  decoyGuessed: "🎭 Gotcha! That was a decoy phrase. Keep chatting.",
  connectionLostTitle: "Connection Lost",
  connectionLostMsg: "Oops, we lost the connection.",
  micPermissionError: "Microphone permission is required for Co-Host mode.",
  englishOnlyNotice: "English only, please!",
  maxMessagesReached: "You've reached the message limit for this level. You can still submit guesses until time runs out!",
  starterChips: [
    "👋 Say hello",
    "❓ Ask what it's guarding",
  ],
  results: {
    winHeading: "YOU DID IT!",
    lockedOutHeading: "OUT OF GUESSES",
    timeoutHeading: "TIME'S UP",
    guardWonMsg: "The guard won this round! Want to try again?",
  },
  buttons: {
    nextLevel: "Next level",
    tryAgain: "Try again",
    finish: "Finish",
    submitGuess: "Check Phrase",
    sendChat: "Send",
    skipVoice: "Skip voice",
    replayVoice: "Replay",
    needHint: "💡 Need a hint?",
    freeHint: "Free",
    exitGame: "Exit Game",
  },
  inputs: {
    chatPlaceholder: "Say something to the guard...",
    guessPlaceholder: "Enter the secret phrase here...",
    handlePlaceholder: "Enter 3-12 letter nickname",
    handleNote: "Pick a nickname, not your real name",
  },
  notices: {
    soundOn: "Turn your sound on! The guard talks back.",
    englishOnly: "English only, for now.",
  },
  lessons: {
    1: {
      plain: "You got a secret just by being friendly. Scammers use the same trick on people, and it works on AI too.",
      technicalName: "social engineering",
    },
    2: {
      plain: "You got around the rules by asking sideways instead of head-on. Attackers use this to make AI ignore its instructions.",
      technicalName: "prompt injection",
    },
    3: {
      plain: "Rules written in plain English can be bent by clever wording. That's why companies pay people to try to break their AI first.",
      technicalName: "red teaming",
    },
    4: {
      plain: "Security teams plant fake secrets to catch snoopers. Did you fall for it?",
      technicalName: "honeytokens",
      decoyVariant: "You fell for the decoy, but you kept going and found the real one. That's exactly how honeytokens catch attackers.",
    },
    5: {
      plain: "You beat a guard with a second safety check watching every word it said. Real AI products use extra checks like this, and people still find ways around them.",
      technicalName: "output guardrails",
    },
  } as Record<number, LessonContent>,
};
