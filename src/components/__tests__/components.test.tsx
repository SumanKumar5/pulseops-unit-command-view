import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";

vi.mock("@/store/useAppStore", () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      connectionState: "connected",
      lastHeartbeat: new Date().toISOString(),
      isMuted: false,
      toggleMute: vi.fn(),
    }),
}));

vi.mock("@/services/sseManager", () => ({
  sseManager: { getQueueSize: () => 0 },
}));

describe("Badge component", () => {
  it("renders children", () => {
    render(<Badge variant="critical">A5</Badge>);
    expect(screen.getByText("A5")).toBeDefined();
  });

  it("renders all acuity variants without error", () => {
    const variants = [
      "acuity1",
      "acuity2",
      "acuity3",
      "acuity4",
      "acuity5",
    ] as const;
    variants.forEach((v) => {
      const { container } = render(<Badge variant={v}>{v}</Badge>);
      expect(container.firstChild).toBeDefined();
    });
  });
});

describe("Spinner component", () => {
  it("renders with sm size", () => {
    const { container } = render(<Spinner size="sm" />);
    expect(container.firstChild).toBeDefined();
  });

  it("renders with lg size", () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.firstChild).toBeDefined();
  });
});

describe("ConnectionBadge component", () => {
  it("renders Live label when connected", () => {
    render(<ConnectionBadge />);
    expect(screen.getByText("Live")).toBeDefined();
  });
});
