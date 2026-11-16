import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("home page renders heading", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});

test("landing headline reads as one sentence and links to sign-in, register, and chat", () => {
  render(<Home />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Care that starts with a conversation");
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  expect(screen.getAllByRole("link", { name: "Create account" })[0]).toHaveAttribute("href", "/register");
  expect(screen.getAllByRole("link", { name: "Chat with Cami" })[0]).toHaveAttribute("href", "/chat");
});

test("landing FAQ answers every question and opens the first", () => {
  const { container } = render(<Home />);

  const items = container.querySelectorAll("#faq details");
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toHaveAttribute("open");
  items.forEach((item) => {
    expect(item.querySelector("p")?.textContent?.trim()).toBeTruthy();
  });
});

test("landing shows the doctors lineup and links to it from the header", () => {
  render(<Home />);

  expect(screen.getByRole("heading", { level: 2, name: "Trusted doctors, right here in Mabini" })).toBeInTheDocument();
  for (const name of [
    "Dra. Marife Alolod-Mauhay",
    "Dr. Raymond Encarnacion",
    "Dra. Katrina Grace Arguelles",
    "Dr. Darren Jansen Manalo",
    "Dra. Charmaine Lynette Bacay",
    "Dr. Nerk Ramos",
  ]) {
    expect(screen.getByRole("img", { name })).toBeInTheDocument();
  }
  expect(screen.getByRole("link", { name: "Doctors" })).toHaveAttribute("href", "#doctors");
});

test("doctors lineup is its own stacking context so photos stay under the sticky header", () => {
  render(<Home />);

  const lineup = screen.getByRole("img", { name: "Dr. Darren Jansen Manalo" }).closest("figure")?.parentElement;
  expect(lineup).toHaveClass("isolate");
});
