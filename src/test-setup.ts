// Test setup for Vitest
import "@testing-library/jest-dom";
import { config as dotenv } from "dotenv";
import { vi } from "vitest";
import { validateEnv } from "../env.d";

// Load test environment variables
dotenv({ path: ".env.test" });
dotenv(); // Load base .env as fallback
validateEnv();

// Mock Next.js fonts globally for all tests
vi.mock("next/font/google", () => ({
  Geist: () => ({
    variable: "--font-geist-sans",
    className: "geist-sans",
  }),
  Geist_Mono: () => ({
    variable: "--font-geist-mono",
    className: "geist-mono",
  }),
}));

// Mock ResizeObserver for chart components
global.ResizeObserver = class ResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }

  private cb: ResizeObserverCallback;

  observe() {
    // Mock implementation
  }

  unobserve() {
    // Mock implementation
  }

  disconnect() {
    // Mock implementation
  }
};

// Mock window.matchMedia for components that check for dark/light mode
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
