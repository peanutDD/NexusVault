import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflowFiles = [
  "src/pages/Files.tsx",
  "src/components/files/FolderBreadcrumb.tsx",
  "src/components/files/list/FileList.tsx",
  "src/components/files/list/FileListHeader.tsx",
  "src/components/files/list/FileListFilters.tsx",
  "src/components/files/list/FileListPagination.tsx",
  "src/components/files/list/FileListSelectionBar.tsx",
  "src/components/files/list/FileListBatchActions.tsx",
  "src/components/files/list/FileListCollectionChips.tsx",
  "src/components/files/grid/FileCard.tsx",
  "src/components/files/grid/FolderCard.tsx",
] as const;

describe("Files workflow Neuromorphic primitive contract", () => {
  const source = workflowFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  it("removes legacy glass and decorative background hooks from active markup", () => {
    for (const banned of [
      "fileListGlassScope",
      "glass-panel",
      "glass-card",
      "glass-chip",
      "glass-btn",
      "backdrop-blur",
    ]) {
      expect(source, banned).not.toContain(banned);
    }
  });

  it("keeps the restored fireworks layer scoped inside the file-list surface", () => {
    expect(readFileSync("src/pages/Files.tsx", "utf8")).not.toContain(
      "backgroundLayer={<FileListBackgroundLayer />}",
    );
    expect(readFileSync("src/components/files/list/FileList.tsx", "utf8")).toContain(
      "<FileListBackgroundLayer />",
    );
  });

  it("maps collection surfaces directly to the global primitives", () => {
    expect(readFileSync("src/components/files/list/FileList.tsx", "utf8")).toContain(
      'className="neu-flat fileListSurfaceScope',
    );
    expect(readFileSync("src/components/files/list/FileListHeader.tsx", "utf8")).toContain(
      'className="neu-raised fileListToolbar',
    );
    expect(readFileSync("src/components/files/grid/FileCard.tsx", "utf8")).toContain(
      '"neu-raised fileCardSurface',
    );
    expect(readFileSync("src/components/files/grid/FolderCard.tsx", "utf8")).toContain(
      '"neu-raised fileCardSurface',
    );
    expect(readFileSync("src/components/files/list/FileListPagination.tsx", "utf8")).toContain(
      '"neu-raised-sm paginationNeuButton',
    );
  });

  it("keeps file collection CSS free of gradients, blur, and tech glow recipes", () => {
    const css = [
      readFileSync("src/components/files/list/FileListGlass.css", "utf8"),
      readFileSync("src/components/files/list/FileListFilters.css", "utf8"),
    ].join("\n");

    expect(css).not.toContain("radial-gradient");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("backdrop-filter");
    expect(css).not.toContain("filelist-tech-glow");
    expect(css).not.toContain("filelist-bar-glow");
    expect(css).not.toContain("background-image:var(--filelist");
  });
});
