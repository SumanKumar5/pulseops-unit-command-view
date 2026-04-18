import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

expect.extend(toHaveNoViolations);

describe("Accessibility — axe-core CI assertions", () => {
  it("Badge has no accessibility violations", async () => {
    const { container } = render(<Badge variant="critical">Critical</Badge>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Spinner has no accessibility violations", async () => {
    const { container } = render(<Spinner size="md" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
