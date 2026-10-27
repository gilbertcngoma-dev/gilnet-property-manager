import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallAppButton, InstallAppProvider } from "./install-app";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(standalone = false) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<InstallAppProvider><InstallAppButton /></InstallAppProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Install app/ }));
}

describe("Install availability", () => {
  it("does not offer native installation in the local preview even if an install event arrives", () => {
    setup();
    fireEvent(window, new Event("beforeinstallprompt", { cancelable: true }));
    expect(screen.getByRole("status")).toHaveTextContent("Open the app link to install");
    expect(screen.queryByRole("button", { name: "Install now" })).toBeNull();
  });

  it("identifies a running standalone app as installed", () => {
    setup(true);
    expect(screen.getByRole("status")).toHaveTextContent("Already installed");
    expect(screen.queryByRole("button", { name: "Install now" })).toBeNull();
  });
});