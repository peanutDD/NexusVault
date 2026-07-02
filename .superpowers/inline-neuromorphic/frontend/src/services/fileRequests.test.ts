import { AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { fileRequestService } from "./fileRequests";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const apiGet = vi.mocked(api.get);
const apiPatch = vi.mocked(api.patch);
const apiPost = vi.mocked(api.post);

const axiosMeta = {
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
};

describe("fileRequestService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://localhost:5173" },
    });
    localStorage.setItem("token", "preview-token");
  });

  it("reads create responses from the backend request field", async () => {
    apiPost.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        request: {
          id: "request-2",
          folder_id: null,
          title: "Upload files",
          description: null,
          allowed_mime_prefixes: [],
          max_file_size: 1024,
          max_uploads: null,
          upload_count: 0,
          expires_at: null,
          revoked_at: null,
          token_prefix: "new123",
          public_url: "http://localhost:5173/request/full-secret-token",
          created_at: "2026-05-21T00:00:00Z",
          updated_at: "2026-05-21T00:00:00Z",
        },
      },
    });

    const result = await fileRequestService.create({
      title: "Upload files",
      max_file_size: 1024,
      expires_in_days: 30,
    });

    expect(apiPost).toHaveBeenCalledWith("/api/file-requests", {
      title: "Upload files",
      max_file_size: 1024,
      expires_in_days: 30,
    });
    expect(result.public_url).toBe("http://localhost:5173/request/full-secret-token");
  });

  it("rebases create public URLs onto the current frontend origin", async () => {
    apiPost.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        request: {
          id: "request-2",
          folder_id: null,
          title: "Upload files",
          description: null,
          allowed_mime_prefixes: [],
          max_file_size: 1024,
          max_uploads: null,
          upload_count: 0,
          expires_at: null,
          revoked_at: null,
          token_prefix: "new123",
          public_url: "http://files.local:5173/request/full-secret-token",
          created_at: "2026-05-21T00:00:00Z",
          updated_at: "2026-05-21T00:00:00Z",
        },
      },
    });

    const result = await fileRequestService.create({
      title: "Upload files",
      max_file_size: 1024,
      expires_in_days: 30,
    });

    expect(result.public_url).toBe("http://localhost:5173/request/full-secret-token");
  });

  it("reads list responses from the backend requests field", async () => {
    apiGet.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        requests: [
          {
            id: "request-1",
            folder_id: null,
            title: "Client upload",
            description: null,
            allowed_mime_prefixes: [],
            max_file_size: 1024,
            max_uploads: null,
            upload_count: 1,
            expires_at: null,
            revoked_at: null,
            token_prefix: "abc123",
            public_url: null,
            created_at: "2026-05-21T00:00:00Z",
            updated_at: "2026-05-21T00:00:00Z",
          },
        ],
      },
    });

    const result = await fileRequestService.list();

    expect(apiGet).toHaveBeenCalledWith("/api/file-requests");
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Client upload");
  });

  it("reads update responses from the backend request field", async () => {
    apiPatch.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        request: {
          id: "request-1",
          folder_id: null,
          title: "Client upload",
          description: null,
          allowed_mime_prefixes: [],
          max_file_size: 1024,
          max_uploads: null,
          upload_count: 1,
          expires_at: null,
          revoked_at: "2026-05-21T01:00:00Z",
          token_prefix: "abc123",
          public_url: null,
          created_at: "2026-05-21T00:00:00Z",
          updated_at: "2026-05-21T01:00:00Z",
        },
      },
    });

    const result = await fileRequestService.update("request-1", { revoked: true });

    expect(apiPatch).toHaveBeenCalledWith("/api/file-requests/request-1", { revoked: true });
    expect(result.revoked_at).toBe("2026-05-21T01:00:00Z");
  });

  it("reads public file request responses from the backend request field", async () => {
    apiGet.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        request: {
          title: "Collect notes",
          description: "Upload text files only",
          allowed_mime_prefixes: ["text/"],
          max_file_size: 2048,
          max_uploads: 1,
          upload_count: 0,
          expires_at: "2026-05-28T00:00:00Z",
        },
      },
    });

    const result = await fileRequestService.getPublic("secret-token");

    expect(apiGet).toHaveBeenCalledWith("/api/file-requests/public/secret-token");
    expect(result.title).toBe("Collect notes");
  });

  it("submits public uploads as an inbox submission with metadata and multiple files", async () => {
    apiPost.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        submission: {
          id: "submission-1",
          request_id: "request-1",
          submitter_email: "client@example.com",
          submitter_note: "Please review",
          file_count: 2,
        },
      },
    });

    const fileA = new File(["a"], "a.txt", { type: "text/plain" });
    const fileB = new File(["b"], "b.txt", { type: "text/plain" });
    const result = await fileRequestService.uploadPublic("secret-token", [fileA, fileB], {
      submitter_email: "client@example.com",
      submitter_note: "Please review",
    });

    expect(apiPost).toHaveBeenCalledWith(
      "/api/file-requests/public/secret-token/upload",
      expect.any(FormData),
    );
    expect(result.submission.file_count).toBe(2);
  });

  it("reads inbox submissions and reviews uploads", async () => {
    apiGet.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        submissions: [
          {
            id: "submission-1",
            request_id: "request-1",
            request_title: "Client upload",
            request_folder_id: "folder-reviewed",
            request_folder_name: "Reviewed Assets",
            submitter_email: "client@example.com",
            submitter_note: "Please review",
            file_count: 1,
            created_at: "2026-05-26T00:00:00Z",
            uploads: [],
          },
        ],
        next_cursor: null,
      },
    });
    apiPatch.mockResolvedValueOnce({
      ...axiosMeta,
      data: {
        upload: {
          id: "upload-1",
          request_id: "request-1",
          submission_id: "submission-1",
          file_id: "file-1",
          filename: "approved.txt",
          file_size: 1,
          mime_type: "text/plain",
          status: "approved",
          scan_status: "not_scanned",
          folder_id: "folder-reviewed",
          folder_name: "Reviewed Assets",
          created_at: "2026-05-26T00:00:00Z",
        },
      },
    });

    const inbox = await fileRequestService.inbox({ status: "pending", request_id: "request-1" });
    const reviewed = await fileRequestService.reviewUpload("upload-1", {
      action: "approve",
      filename: "approved.txt",
      folder_id: null,
    });

    expect(apiGet).toHaveBeenCalledWith("/api/file-requests/inbox", {
      params: { status: "pending", request_id: "request-1" },
    });
    expect(apiPatch).toHaveBeenCalledWith("/api/file-requests/uploads/upload-1/review", {
      action: "approve",
      filename: "approved.txt",
      folder_id: null,
    });
    expect(inbox.submissions[0]?.submitter_email).toBe("client@example.com");
    expect(inbox.submissions[0]?.request_folder_name).toBe("Reviewed Assets");
    expect(reviewed.status).toBe("approved");
    expect(reviewed.folder_name).toBe("Reviewed Assets");
    expect(fileRequestService.previewUploadUrl("upload-1")).toBe(
      "/api/file-requests/uploads/upload-1/preview?token=preview-token",
    );
    expect(fileRequestService.previewApprovedFileUrl("file-1")).toBe(
      "/api/files/file-1/preview?token=preview-token",
    );
    expect(fileRequestService.downloadUploadUrl("upload-1")).toBe(
      "/api/file-requests/uploads/upload-1/download?token=preview-token",
    );
  });
});
