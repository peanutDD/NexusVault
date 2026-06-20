import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Login from "./Login";
import Register from "./Register";

describe("auth pages", () => {
  it("does not mount the obsolete Shape Wave behind the login form", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("auth-shape-wave-background")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("does not mount the obsolete Shape Wave behind the registration form", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("auth-shape-wave-background")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });
});
