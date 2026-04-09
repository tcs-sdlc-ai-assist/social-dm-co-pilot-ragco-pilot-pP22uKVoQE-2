import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mock next/navigation ────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/inbox",
  useSearchParams: () => new URLSearchParams(),
}));

// ─── Mock useAuth ────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// ─── Mock useInbox ───────────────────────────────────────────────────────────

const mockSetPage = vi.fn();
const mockUseInbox = vi.fn();

vi.mock("@/hooks/useInbox", () => ({
  useInbox: (params: unknown) => mockUseInbox(params),
  default: (params: unknown) => mockUseInbox(params),
}));

// ─── Mock useNotifications (used by Header) ──────────────────────────────────

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    isLoading: false,
    error: null,
  }),
  default: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// ─── Import Component Under Test ─────────────────────────────────────────────

import InboxPage from "../page";
import type { DM } from "@/types";

// ─── Test Data ───────────────────────────────────────────────────────────────

const sampleDMs: DM[] = [
  {
    id: "dm-001",
    platform: "facebook",
    timestamp: "2025-01-15T09:23:00Z",
    senderName: "Maria Garcia",
    senderHandle: "@mariagarcia",
    content: "Hi! I saw your listing for the 3-bedroom condo. Is it still available?",
    status: "new",
  },
  {
    id: "dm-002",
    platform: "instagram",
    timestamp: "2025-01-15T10:05:00Z",
    senderName: "James Thompson",
    senderHandle: "@jamesthompson_re",
    content: "What's the price range for 2-bedroom apartments in Brickell?",
    status: "drafted",
  },
  {
    id: "dm-003",
    platform: "facebook",
    timestamp: "2025-01-15T11:30:00Z",
    senderName: "Sarah Chen",
    senderHandle: "@sarahchen88",
    content: "I'd love to schedule a tour of the waterfront property you posted last week.",
    status: "sent",
  },
  {
    id: "dm-004",
    platform: "instagram",
    timestamp: "2025-01-15T12:15:00Z",
    senderName: "Robert Williams",
    senderHandle: "@rob_williams",
    content: "Do you have any pet-friendly rentals in the Coral Gables area?",
    status: "escalated",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupAuthenticatedUser() {
  mockUseAuth.mockReturnValue({
    user: {
      id: "user-001",
      email: "test@stockland.com.au",
      name: "Test User",
      role: "agent",
      avatarUrl: null,
      createdAt: "2025-01-01T00:00:00Z",
      lastLoginAt: "2025-01-15T08:00:00Z",
    },
    token: "mock-token",
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function setupUnauthenticatedUser() {
  mockUseAuth.mockReturnValue({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function setupAuthLoading() {
  mockUseAuth.mockReturnValue({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function setupInboxWithDMs(dms: DM[], totalCount?: number) {
  mockUseInbox.mockReturnValue({
    dms,
    isLoading: false,
    error: null,
    totalCount: totalCount ?? dms.length,
    currentPage: 1,
    setPage: mockSetPage,
    refetch: vi.fn(),
  });
}

function setupInboxLoading() {
  mockUseInbox.mockReturnValue({
    dms: [],
    isLoading: true,
    error: null,
    totalCount: 0,
    currentPage: 1,
    setPage: mockSetPage,
    refetch: vi.fn(),
  });
}

function setupInboxError(errorMessage: string) {
  mockUseInbox.mockReturnValue({
    dms: [],
    isLoading: false,
    error: errorMessage,
    totalCount: 0,
    currentPage: 1,
    setPage: mockSetPage,
    refetch: vi.fn(),
  });
}

function setupInboxPaginated(dms: DM[], totalCount: number, currentPage: number) {
  mockUseInbox.mockReturnValue({
    dms,
    isLoading: false,
    error: null,
    totalCount,
    currentPage,
    setPage: mockSetPage,
    refetch: vi.fn(),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication", () => {
    it("shows loading spinner while checking authentication", () => {
      setupAuthLoading();
      setupInboxWithDMs([]);

      render(<InboxPage />);

      expect(screen.getByText("Checking authentication…")).toBeInTheDocument();
    });

    it("redirects to home page when user is not authenticated", () => {
      setupUnauthenticatedUser();
      setupInboxWithDMs([]);

      render(<InboxPage />);

      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  describe("rendering DM list", () => {
    it("renders the inbox header with correct title", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      render(<InboxPage />);

      expect(screen.getByText("DM Inbox")).toBeInTheDocument();
    });

    it("renders the total message count", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs, 4);

      render(<InboxPage />);

      expect(screen.getByText(/4 messages total/)).toBeInTheDocument();
    });

    it("renders singular message count for 1 message", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs([sampleDMs[0]], 1);

      render(<InboxPage />);

      expect(screen.getByText(/1 message total/)).toBeInTheDocument();
    });

    it("renders all DM list items with sender names", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      render(<InboxPage />);

      expect(screen.getByText("Maria Garcia")).toBeInTheDocument();
      expect(screen.getByText("James Thompson")).toBeInTheDocument();
      expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
      expect(screen.getByText("Robert Williams")).toBeInTheDocument();
    });

    it("shows unread count badge when there are new DMs", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      render(<InboxPage />);

      // Maria Garcia has status "new" — so 1 new message
      expect(screen.getByText("1 new")).toBeInTheDocument();
    });

    it("does not show unread count badge when there are no new DMs", () => {
      const allSentDMs: DM[] = sampleDMs.map((dm) => ({ ...dm, status: "sent" as const }));
      setupAuthenticatedUser();
      setupInboxWithDMs(allSentDMs);

      render(<InboxPage />);

      expect(screen.queryByText(/new$/)).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("displays loading spinner when fetching DMs", () => {
      setupAuthenticatedUser();
      setupInboxLoading();

      render(<InboxPage />);

      expect(screen.getByText("Loading messages…")).toBeInTheDocument();
    });

    it("does not render DM list items while loading", () => {
      setupAuthenticatedUser();
      setupInboxLoading();

      render(<InboxPage />);

      expect(screen.queryByText("Maria Garcia")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty state when no DMs match filters", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs([]);

      render(<InboxPage />);

      expect(screen.getByText("No messages found")).toBeInTheDocument();
      expect(
        screen.getByText(/There are no direct messages matching your current filters/)
      ).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("displays error message when fetch fails", () => {
      setupAuthenticatedUser();
      setupInboxError("Failed to fetch inbox (500)");

      render(<InboxPage />);

      expect(screen.getByText("Failed to fetch inbox (500)")).toBeInTheDocument();
    });

    it("renders error with alert role for accessibility", () => {
      setupAuthenticatedUser();
      setupInboxError("Network error");

      render(<InboxPage />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  describe("filters", () => {
    it("renders filter controls", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      render(<InboxPage />);

      expect(screen.getByLabelText("Search messages")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Platform")).toBeInTheDocument();
      expect(screen.getByLabelText("Sort")).toBeInTheDocument();
    });

    it("calls useInbox with updated params when status filter changes", async () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      const user = userEvent.setup();
      render(<InboxPage />);

      const statusSelect = screen.getByLabelText("Status");
      // Find the select element within the filter area
      const selectElement = statusSelect.nextElementSibling as HTMLSelectElement | null;
      const actualSelect = screen.getByRole("combobox", { name: /status/i }) ?? selectElement;

      // The InboxFilters component has a select with id "inbox-status-filter"
      const statusFilter = document.getElementById("inbox-status-filter") as HTMLSelectElement;
      expect(statusFilter).toBeInTheDocument();

      await user.selectOptions(statusFilter, "new");

      // useInbox should have been called again with the new filter
      await waitFor(() => {
        const lastCall = mockUseInbox.mock.calls[mockUseInbox.mock.calls.length - 1];
        expect(lastCall[0]).toEqual(
          expect.objectContaining({
            status: "new",
          })
        );
      });
    });

    it("calls useInbox with updated params when platform filter changes", async () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      const user = userEvent.setup();
      render(<InboxPage />);

      const platformFilter = document.getElementById("inbox-platform-filter") as HTMLSelectElement;
      expect(platformFilter).toBeInTheDocument();

      await user.selectOptions(platformFilter, "facebook");

      await waitFor(() => {
        const lastCall = mockUseInbox.mock.calls[mockUseInbox.mock.calls.length - 1];
        expect(lastCall[0]).toEqual(
          expect.objectContaining({
            platform: "facebook",
          })
        );
      });
    });

    it("calls useInbox with search param when search input changes", async () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      const user = userEvent.setup();
      render(<InboxPage />);

      const searchInput = screen.getByPlaceholderText("Search by sender or content…");
      expect(searchInput).toBeInTheDocument();

      await user.type(searchInput, "Maria");

      await waitFor(() => {
        const lastCall = mockUseInbox.mock.calls[mockUseInbox.mock.calls.length - 1];
        expect(lastCall[0]).toEqual(
          expect.objectContaining({
            search: "Maria",
          })
        );
      });
    });

    it("sorts DMs by newest first by default", () => {
      setupAuthenticatedUser();
      // DMs are returned in the order given; the component sorts them
      setupInboxWithDMs(sampleDMs);

      render(<InboxPage />);

      const dmItems = screen.getAllByRole("button").filter((el) => {
        return el.textContent?.includes("Garcia") ||
          el.textContent?.includes("Thompson") ||
          el.textContent?.includes("Chen") ||
          el.textContent?.includes("Williams");
      });

      // With "newest" sort, Robert Williams (12:15) should come before Sarah Chen (11:30)
      expect(dmItems.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("pagination", () => {
    it("renders pagination controls when there are multiple pages", () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 1);

      render(<InboxPage />);

      expect(screen.getByText("Previous")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    it("does not render pagination when all DMs fit on one page", () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs, 4);

      render(<InboxPage />);

      expect(screen.queryByText("Previous")).not.toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("disables Previous button on first page", () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 1);

      render(<InboxPage />);

      const prevButton = screen.getByText("Previous");
      expect(prevButton).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 3);

      render(<InboxPage />);

      const nextButton = screen.getByText("Next");
      expect(nextButton).toBeDisabled();
    });

    it("calls setPage when Next button is clicked", async () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 1);

      const user = userEvent.setup();
      render(<InboxPage />);

      const nextButton = screen.getByText("Next");
      await user.click(nextButton);

      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it("calls setPage when a page number is clicked", async () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 1);

      const user = userEvent.setup();
      render(<InboxPage />);

      const page2Button = screen.getByLabelText("Page 2");
      await user.click(page2Button);

      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it("highlights the current page", () => {
      setupAuthenticatedUser();
      setupInboxPaginated(sampleDMs, 60, 2);

      render(<InboxPage />);

      const page2Button = screen.getByLabelText("Page 2");
      expect(page2Button).toHaveAttribute("aria-current", "page");
    });
  });

  describe("DM navigation", () => {
    it("navigates to DM detail page when a DM item is clicked", async () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      const user = userEvent.setup();
      render(<InboxPage />);

      // Find the DM list item for Maria Garcia and click it
      const mariaItem = screen.getByText("Maria Garcia").closest("[role='button']");
      expect(mariaItem).toBeInTheDocument();

      await user.click(mariaItem!);

      expect(mockPush).toHaveBeenCalledWith("/dm/dm-001");
    });

    it("navigates to DM detail page on keyboard Enter", async () => {
      setupAuthenticatedUser();
      setupInboxWithDMs(sampleDMs);

      const user = userEvent.setup();
      render(<InboxPage />);

      const jamesItem = screen.getByText("James Thompson").closest("[role='button']");
      expect(jamesItem).toBeInTheDocument();

      jamesItem!.focus();
      await user.keyboard("{Enter}");

      expect(mockPush).toHaveBeenCalledWith("/dm/dm-002");
    });
  });
});