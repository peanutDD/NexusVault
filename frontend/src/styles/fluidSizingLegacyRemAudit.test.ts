import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

const legacySizingExpectations: Array<{
  file: string;
  forbidden: string[];
}> = [
  {
    file: "src/pages/Trash.tsx",
    forbidden: ["text-[0.58rem]", "text-[0.62rem]", "text-[0.6rem]", "sm:text-[0.68rem]"],
  },
  {
    file: "src/components/files/list/FileListRow.tsx",
    forbidden: ["text-[0.65rem]", "text-[0.625rem]"],
  },
  {
    file: "src/components/files/list/FileListBatchActions.tsx",
    forbidden: ["text-[0.625rem]"],
  },
  {
    file: "src/components/files/FolderBreadcrumb.tsx",
    forbidden: ["text-[0.625rem]"],
  },
  {
    file: "src/components/files/preview/MarkdownCodeBlock.tsx",
    forbidden: ["text-[0.7rem]"],
  },
  {
    file: "src/components/files/preview/markdownPreviewComponents.tsx",
    forbidden: ["text-[0.78rem]", "text-[0.76rem]", "text-[0.72rem]", "text-[0.7rem]"],
  },
  {
    file: "src/components/files/preview/MobilePdfPreview.tsx",
    forbidden: ["min-h-[12.5rem]", "text-[0.625rem]"],
  },
  {
    file: "src/components/files/preview/PdfPreview.tsx",
    forbidden: ["min-h-[12.5rem]"],
  },
  {
    file: "src/components/ErrorBoundary.tsx",
    forbidden: ["max-w-[28rem]"],
  },
  {
    file: "src/components/common/EmptyState.tsx",
    forbidden: ["max-w-[24rem]"],
  },
  {
    file: "src/components/settings/WebDavAccessSection.tsx",
    forbidden: ["max-w-[42rem]"],
  },
  {
    file: "src/components/files/dialogs/RenameFileDialog.tsx",
    forbidden: ["text-[0.65rem]"],
  },
  {
    file: "src/components/files/dialogs/RenameFolderDialog.tsx",
    forbidden: ["text-[0.65rem]"],
  },
  {
    file: "src/components/files/dialogs/CreateFolderDialog.tsx",
    forbidden: ["text-[0.65rem]"],
  },
  {
    file: "src/components/files/dialogs/BatchMoveDialog.tsx",
    forbidden: ["text-[0.65rem]", "text-[0.625rem]"],
  },
  {
    file: "src/components/files/dialogs/BatchShareDialog.tsx",
    forbidden: ["text-[0.65rem]"],
  },
  {
    file: "src/components/common/feedback/Skeleton.tsx",
    forbidden: ["min-w-[60rem]", "w-[4.5rem]", "min-w-[11.25rem]"],
  },
  {
    file: "src/components/files/list/FileList.tsx",
    forbidden: ["h-[5.25rem]", "sm:h-[6rem]"],
  },
  {
    file: "src/components/files/dialogs/FileActivityDialog.tsx",
    forbidden: ["gap-[0.5rem]", "h-[1rem]", "w-[1rem]", "min-h-[10rem]", "h-[1.5rem]", "w-[1.5rem]", "gap-[0.35rem]", "h-[0.9rem]", "w-[0.9rem]", "py-[0.5rem]"],
  },
  {
    file: "src/components/files/dialogs/VersionHistoryDialog.tsx",
    forbidden: ["min-w-[8rem]"],
  },
  {
    file: "src/components/files/preview/FilePreviewStates.tsx",
    forbidden: ["max-w-[22rem]"],
  },
  {
    file: "src/components/files/preview/FilePreviewTextPanel.tsx",
    forbidden: ["max-w-[60rem]"],
  },
  {
    file: "src/components/files/preview/FilePreviewStage.tsx",
    forbidden: ["max-w-[70rem]"],
  },
];

describe("legacy fluid sizing rem audit", () => {
  it("removes fixed rem utility sizes from the remaining high-traffic UI surfaces", () => {
    for (const expectation of legacySizingExpectations) {
      const source = readProjectFile(expectation.file);

      for (const forbidden of expectation.forbidden) {
        expect(source, `${expectation.file} should not include ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
