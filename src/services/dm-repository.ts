import { DM, DMStatus } from "../types";

// ─── Sample DM Data (inline, as sample-dms.json) ────────────────────────────

const sampleDMs: DM[] = [
  {
    id: "fb_100001",
    platform: "facebook",
    timestamp: "2024-06-01T09:15:00Z",
    senderName: "Sarah Jones",
    senderHandle: "@sarahjones",
    content: "Hi, I'm interested in the new development at Willowdale. Can you send me some info?",
    status: "new",
  },
  {
    id: "fb_100002",
    platform: "facebook",
    timestamp: "2024-06-01T10:22:00Z",
    senderName: "Michael Chen",
    senderHandle: "@michaelchen",
    content: "What's the price range for 3-bedroom homes in your Aura project?",
    status: "new",
  },
  {
    id: "ig_200001",
    platform: "instagram",
    timestamp: "2024-06-01T11:05:00Z",
    senderName: "Emily Watson",
    senderHandle: "@emilyw_realestate",
    content: "Love the photos of Cloverton! Are there any lots still available under $500k?",
    status: "new",
  },
  {
    id: "fb_100003",
    platform: "facebook",
    timestamp: "2024-06-01T12:34:56Z",
    senderName: "David Park",
    senderHandle: "@davidpark88",
    content: "I'd like to book a tour of the display homes at Minta this weekend. Is that possible?",
    status: "drafted",
  },
  {
    id: "ig_200002",
    platform: "instagram",
    timestamp: "2024-06-01T13:45:00Z",
    senderName: "Jessica Liu",
    senderHandle: "@jessicaliu",
    content: "Do you offer any first home buyer incentives? My partner and I are looking to buy our first home.",
    status: "new",
  },
  {
    id: "fb_100004",
    platform: "facebook",
    timestamp: "2024-06-02T08:00:00Z",
    senderName: "Tom Richards",
    senderHandle: "@tomrichards",
    content: "Can you tell me about the community facilities planned for Calleya?",
    status: "sent",
  },
  {
    id: "ig_200003",
    platform: "instagram",
    timestamp: "2024-06-02T09:30:00Z",
    senderName: "Priya Sharma",
    senderHandle: "@priyasharma_au",
    content: "Is there a land and house package available at Stockland Elara? Budget around $750k.",
    status: "escalated",
  },
];

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const dmStore: Map<string, DM> = new Map();

// Initialize store with sample data
function initializeStore(): void {
  for (const dm of sampleDMs) {
    dmStore.set(dm.id, { ...dm });
  }
}

initializeStore();

// ─── Deduplication Helper ────────────────────────────────────────────────────

function isDuplicate(dm: DM): boolean {
  if (dmStore.has(dm.id)) {
    return true;
  }

  for (const existing of dmStore.values()) {
    if (
      existing.platform === dm.platform &&
      existing.senderHandle === dm.senderHandle &&
      existing.content === dm.content &&
      existing.timestamp === dm.timestamp
    ) {
      return true;
    }
  }

  return false;
}

// ─── Repository Exports ──────────────────────────────────────────────────────

export function getAllDMs(): DM[] {
  return Array.from(dmStore.values());
}

export function getDMById(id: string): DM | null {
  const dm = dmStore.get(id);
  return dm ? { ...dm } : null;
}

export function addDM(dm: DM): DM {
  if (isDuplicate(dm)) {
    const existing = dmStore.get(dm.id);
    if (existing) {
      return { ...existing };
    }

    for (const entry of dmStore.values()) {
      if (
        entry.platform === dm.platform &&
        entry.senderHandle === dm.senderHandle &&
        entry.content === dm.content &&
        entry.timestamp === dm.timestamp
      ) {
        return { ...entry };
      }
    }
  }

  const newDM: DM = { ...dm };
  dmStore.set(newDM.id, newDM);
  return { ...newDM };
}

export function updateDMStatus(id: string, status: DMStatus): DM | null {
  const dm = dmStore.get(id);
  if (!dm) {
    return null;
  }

  dm.status = status;
  dmStore.set(id, dm);
  return { ...dm };
}

export function getDMsByStatus(status: DMStatus): DM[] {
  const results: DM[] = [];
  for (const dm of dmStore.values()) {
    if (dm.status === status) {
      results.push({ ...dm });
    }
  }
  return results;
}

export function getDMsByPlatform(platform: string): DM[] {
  const results: DM[] = [];
  for (const dm of dmStore.values()) {
    if (dm.platform === platform) {
      results.push({ ...dm });
    }
  }
  return results;
}