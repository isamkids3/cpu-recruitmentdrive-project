export interface AttemptState {
  nonce: string;
  level: number;
  guessesUsed: number;
  hintsUsed: number;
  decoyTripped: boolean;
  done: boolean;
  startedAt: number;
}

// Global in-memory fallback map (persists across Next.js dev hot-reloads)
declare global {
  // eslint-disable-next-line no-var
  var __attemptState: Map<string, AttemptState> | undefined;
}

const memoryStore = (globalThis.__attemptState ??= new Map<string, AttemptState>());

async function getFromRedis(nonce: string): Promise<AttemptState | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/attempt:${nonce}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch (err) {
    console.error("Redis get attempt error:", err);
    return null;
  }
}

async function setToRedis(state: AttemptState): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(`${url}/set/attempt:${state.nonce}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state),
    });
  } catch (err) {
    console.error("Redis set attempt error:", err);
  }
}

export async function getAttemptState(nonce: string): Promise<AttemptState | null> {
  if (process.env.KV_REST_API_URL) {
    const redisVal = await getFromRedis(nonce);
    if (redisVal) return redisVal;
  }
  return memoryStore.get(nonce) || null;
}

export async function createAttemptState(
  nonce: string,
  level: number,
  startedAt: number
): Promise<AttemptState> {
  const state: AttemptState = {
    nonce,
    level,
    guessesUsed: 0,
    hintsUsed: 0,
    decoyTripped: false,
    done: false,
    startedAt,
  };

  memoryStore.set(nonce, state);

  if (process.env.KV_REST_API_URL) {
    await setToRedis(state);
  }

  return state;
}

export async function updateAttemptState(state: AttemptState): Promise<void> {
  memoryStore.set(state.nonce, state);

  if (process.env.KV_REST_API_URL) {
    await setToRedis(state);
  }
}
