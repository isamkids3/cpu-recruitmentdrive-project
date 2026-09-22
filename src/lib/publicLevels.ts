export interface PublicLevel {
  id: number;
  codename: string;
  tagline: string;
  timeLimitSec: number;
  maxGuesses: number;
  maxMessages: number;
  basePoints: number;
  hintPenaltyPct: number;
  fuzzy?: boolean;
  voice?: string;
}

export const PUBLIC_LEVELS: PublicLevel[] = [
  {
    id: 1,
    codename: "Rookie Guard",
    tagline: "First day on the job. Very friendly.",
    timeLimitSec: 120,
    maxGuesses: 5,
    maxMessages: 30,
    basePoints: 100,
    hintPenaltyPct: 0,
    fuzzy: false,
    voice: "Puck",
  },
  {
    id: 2,
    codename: "Nervous Intern",
    tagline: "Helpful, but knows it shouldn't tell.",
    timeLimitSec: 120,
    maxGuesses: 5,
    maxMessages: 30,
    basePoints: 200,
    hintPenaltyPct: 15,
    fuzzy: false,
    voice: "Aoede",
  },
  {
    id: 3,
    codename: "Security Analyst",
    tagline: "This guard has been trained to ignore tricks.",
    timeLimitSec: 180,
    maxGuesses: 5,
    maxMessages: 30,
    basePoints: 300,
    hintPenaltyPct: 15,
    fuzzy: false,
    voice: "Fenrir",
  },
  {
    id: 4,
    codename: "Paranoid Sentinel",
    tagline: "Trusts no one. Not everything it says is true.",
    timeLimitSec: 180,
    maxGuesses: 5,
    maxMessages: 30,
    basePoints: 500,
    hintPenaltyPct: 15,
    fuzzy: false,
    voice: "Kore",
  },
  {
    id: 5,
    codename: "Fort Knox",
    tagline: "The toughest guard in the building.",
    timeLimitSec: 210,
    maxGuesses: 5,
    maxMessages: 30,
    basePoints: 1000,
    hintPenaltyPct: 15,
    fuzzy: false,
    voice: "Charon",
  },
];
