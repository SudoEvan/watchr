/**
 * Login page tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../test/test-utils";
import Login from "./Login";

// Mock the API client
vi.mock("../api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import client from "../api/client";

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form by default", () => {
    render(<Login />);
    expect(screen.getByText("Watchr")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your watchlists")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("toggles to register form", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByText("Register"));
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Display Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("submits login form and stores token", async () => {
    const user = userEvent.setup();
    const mockPost = vi.mocked(client.post);
    mockPost.mockResolvedValueOnce({
      data: { access_token: "test-jwt-token", token_type: "bearer" },
    });

    render(<Login />);
    await user.type(screen.getByPlaceholderText("Username"), "testuser");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(localStorage.getItem("watchr_token")).toBe("test-jwt-token");
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("shows error on failed login", async () => {
    const user = userEvent.setup();
    const mockPost = vi.mocked(client.post);
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: "Incorrect username or password" } },
    });

    render(<Login />);
    await user.type(screen.getByPlaceholderText("Username"), "bad");
    await user.type(screen.getByPlaceholderText("Password"), "bad");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Incorrect username or password")).toBeInTheDocument();
    });
  });

  it("submits register then login", async () => {
    const user = userEvent.setup();
    const mockPost = vi.mocked(client.post);

    // First call: register, second call: login
    mockPost
      .mockResolvedValueOnce({ data: {} }) // register
      .mockResolvedValueOnce({
        data: { access_token: "new-jwt", token_type: "bearer" },
      }); // login

    render(<Login />);
    await user.click(screen.getByText("Register"));
    await user.type(screen.getByPlaceholderText("Username"), "newuser");
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Display Name"), "New User");
    await user.type(screen.getByPlaceholderText("Password"), "securepass");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem("watchr_token")).toBe("new-jwt");
    });
  });
});
