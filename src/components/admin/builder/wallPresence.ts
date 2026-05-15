// Cross-tab presence detection for the wall display.
//
// The wall (PreviewView) heartbeats on a BroadcastChannel every ~1.5s.
// The controller (LiveCaseScreen) listens and considers the wall "open" if
// it has received a heartbeat within the last 4s. When the wall tab closes,
// the heartbeats stop and the controller flips its presence flag to false
// within a couple of seconds.

const CHANNEL_NAME = "art-setup.wall-presence.v1";
const HEARTBEAT_MS = 1500;
const STALE_MS = 4000;
const POLL_MS = 1500;

interface AliveMessage {
  kind: "wall-alive";
}

function hasBroadcastChannel(): boolean {
  return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";
}

/** Start advertising "wall is open" on the BroadcastChannel. Returns a
 *  cleanup function that stops the heartbeat and closes the channel. */
export function startWallHeartbeat(): () => void {
  if (!hasBroadcastChannel()) return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const post = () => {
    try {
      channel.postMessage({ kind: "wall-alive" } as AliveMessage);
    } catch {
      // ignore — channel may have been closed
    }
  };
  post();
  const id = window.setInterval(post, HEARTBEAT_MS);
  return () => {
    window.clearInterval(id);
    try {
      channel.close();
    } catch {
      // already closed
    }
  };
}

/** Listen for wall-alive heartbeats from other tabs. Calls `onChange(open)`
 *  whenever the open/closed state flips. */
export function subscribeWallPresence(onChange: (open: boolean) => void): () => void {
  if (!hasBroadcastChannel()) return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  let lastAlive = 0;
  let currentOpen = false;

  const refresh = () => {
    const open = Date.now() - lastAlive < STALE_MS;
    if (open !== currentOpen) {
      currentOpen = open;
      onChange(open);
    }
  };

  const handler = (e: MessageEvent<AliveMessage>) => {
    if (e.data?.kind !== "wall-alive") return;
    lastAlive = Date.now();
    refresh();
  };
  channel.addEventListener("message", handler);

  const intervalId = window.setInterval(refresh, POLL_MS);
  return () => {
    channel.removeEventListener("message", handler);
    window.clearInterval(intervalId);
    try {
      channel.close();
    } catch {
      // already closed
    }
  };
}
