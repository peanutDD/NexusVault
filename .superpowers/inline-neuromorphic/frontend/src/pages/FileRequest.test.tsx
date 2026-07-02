import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileRequest from "./FileRequest";
import { fileRequestService } from "../services/fileRequests";

vi.mock("../services/fileRequests", () => ({
  fileRequestService: {
    getPublic: vi.fn(),
    uploadPublic: vi.fn(),
  },
}));

function renderPublicRequest() {
  return render(
    <MemoryRouter initialEntries={["/request/full-token"]}>
      <Routes>
        <Route path="/request/:token" element={<FileRequest />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fileRequestService.getPublic).mockResolvedValue({
    title: "Upload evidence",
    description: "PDF only",
    allowed_mime_prefixes: ["application/pdf"],
    max_file_size: 4096,
    max_uploads: 3,
    upload_count: 1,
    expires_at: null,
  });
  vi.mocked(fileRequestService.uploadPublic).mockResolvedValue({
    submission: {
      id: "submission-1",
      request_id: "request-1",
      submitter_email: "client@example.com",
      submitter_note: "signed copy",
      file_count: 1,
    },
  });
});

describe("FileRequest public page", () => {
  it("uses upload-only neuromorphic surfaces with no browse or login escape hatch", async () => {
    renderPublicRequest();

    expect(await screen.findByText("Upload evidence")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-page-shell")).toHaveClass("fileRequestPageShell");
    expect(screen.getByTestId("file-request-page-card")).toHaveClass("sharePageCard");
    expect(screen.getByTestId("file-request-limits-panel")).toHaveClass("shareFileInfoPanel");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/返回登录/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/browse/i)).not.toBeInTheDocument();
  });

  it("submits email, note, and selected files to the public token endpoint", async () => {
    renderPublicRequest();

    await screen.findByText("Upload evidence");
    const file = new File(["hello"], "evidence.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/submitter email/i), {
      target: { value: "client@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/submitter note/i), {
      target: { value: "signed copy" },
    });
    fireEvent.change(screen.getByLabelText(/choose files/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(fileRequestService.uploadPublic).toHaveBeenCalledWith("full-token", [file], {
        submitter_email: "client@example.com",
        submitter_note: "signed copy",
      });
    });
    expect(await screen.findByText(/等待审核/i)).toBeInTheDocument();
  });

  it("uses a mobile-safe public upload layout with no horizontal overflow traps", async () => {
    renderPublicRequest();

    expect(await screen.findByText("Upload evidence")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-page-shell")).toHaveClass(
      "items-center",
      "overflow-x-hidden",
    );
    expect(screen.getByTestId("file-request-page-card")).toHaveClass(
      "max-w-[min(100%,38rem)]",
      "overflow-hidden",
    );
    expect(screen.getByLabelText(/choose files/i)).toHaveClass(
      "min-w-0",
      "text-[length:var(--settings-text-xs)]",
    );
  });

  it("matches the CodePen neuromorphic upload form contract", async () => {
    renderPublicRequest();

    expect(await screen.findByText("Upload evidence")).toBeInTheDocument();

    const source = readFileSync(resolve(__dirname, "./FileRequest.tsx"), "utf8");
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");
    const cardCss = baseCss.match(/\.fileRequestPublicCard\s*\{[^}]*\}/)?.[0] ?? "";
    const insetCss = baseCss.match(/\.fileRequestPublicInset\s*\{[^}]*\}/)?.[0] ?? "";
    const fieldCss = baseCss.match(/\.fileRequestPublicField\s*\{[^}]*\}/)?.[0] ?? "";
    const submitCss = baseCss.match(/\.fileRequestPublicSubmit\s*\{[^}]*\}/)?.[0] ?? "";
    const disabledSubmitCss = baseCss.match(/\.fileRequestPublicSubmit:disabled\s*\{[^}]*\}/)?.[0] ?? "";

    expect(screen.getByTestId("file-request-page-shell")).toHaveClass("fileRequestPublicShell", "items-center");
    expect(screen.getByTestId("file-request-page-card")).toHaveClass("fileRequestPublicCard", "self-start");
    expect(screen.getByTestId("file-request-limits-panel")).toHaveClass("fileRequestPublicInset");
    expect(screen.getByLabelText(/submitter email/i)).toHaveClass("fileRequestPublicField");
    expect(screen.getByLabelText(/submitter note/i)).toHaveClass("fileRequestPublicField");
    expect(screen.getByLabelText(/choose files/i)).toHaveClass("fileRequestPublicField");
    expect(screen.getByRole("button", { name: /submit for review/i })).toHaveClass("fileRequestPublicSubmit");
    expect(source).not.toContain("items-stretch");
    expect(source).not.toContain("singleShareDialogField");
    expect(source).not.toContain("singleShareDialogPrimary");
    expect(baseCss).toContain("--file-request-public-page-bg: #343c4a;");
    expect(cardCss).toContain("background: var(--file-request-public-raised-bg);");
    expect(cardCss).toContain("box-shadow: var(--file-request-public-card-shadow);");
    expect(insetCss).toContain("background: var(--file-request-public-inset-bg);");
    expect(insetCss).toContain("box-shadow: var(--file-request-public-inset-shadow);");
    expect(fieldCss).toContain("background: var(--file-request-public-inset-bg);");
    expect(fieldCss).toContain("box-shadow: var(--file-request-public-inset-shadow);");
    expect(submitCss).toContain("background: var(--file-request-public-primary-bg);");
    expect(disabledSubmitCss).toContain("opacity: 1;");
    expect(disabledSubmitCss).toContain("background: var(--file-request-public-primary-disabled-bg);");
  });
});
