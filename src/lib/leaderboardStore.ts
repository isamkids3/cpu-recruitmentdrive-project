import fs from "fs";
import path from "path";

export interface LeaderboardEntry {
  handle: string;
  totalPoints: number;
  levelsCleared: number;
  totalElapsedSec: number;
  ts: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  claimedNonces: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "leaderboard.json");

function ensureDirectoryExists(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDataFromFile(): LeaderboardData {
  ensureDirectoryExists();
  if (!fs.existsSync(FILE_PATH)) {
    const initial: LeaderboardData = { entries: [], claimedNonces: [] };
    fs.writeFileSync(FILE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw) as LeaderboardData;
  } catch (err) {
    console.error("Error reading leaderboard.json:", err);
    return { entries: [], claimedNonces: [] };
  }
}

function writeDataToFile(data: LeaderboardData): void {
  ensureDirectoryExists();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getLeaderboard(topN: number = 10): Promise<LeaderboardEntry[]> {
  const data = readDataFromFile();
  // Sort by totalPoints descending, then by totalElapsedSec ascending, then timestamp
  const sorted = [...data.entries].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (a.totalElapsedSec !== b.totalElapsedSec) {
      return a.totalElapsedSec - b.totalElapsedSec;
    }
    return a.ts - b.ts;
  });

  return sorted.slice(0, topN);
}

export async function hasClaimedNonce(nonce: string): Promise<boolean> {
  const data = readDataFromFile();
  return data.claimedNonces.includes(nonce);
}

export async function addLeaderboardEntry(
  entry: LeaderboardEntry,
  nonces: string[]
): Promise<LeaderboardEntry[]> {
  const data = readDataFromFile();

  data.entries.push(entry);
  for (const n of nonces) {
    if (!data.claimedNonces.includes(n)) {
      data.claimedNonces.push(n);
    }
  }

  writeDataToFile(data);
  return getLeaderboard(10);
}

export function resetLeaderboardStore(): void {
  const initial: LeaderboardData = { entries: [], claimedNonces: [] };
  writeDataToFile(initial);
}

