import { useEffect } from "react";
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
} from "react-router-dom";
import { APP_NAME } from "../../config/env";
import { cn } from "../../utils/cn";
import { ArrowLeft, ListChecks, LogOut, Settings, Trash2 } from "lucide-react";
import { CyberPrismLogo } from "../common/CyberPrismLogo";
import ThemeToggle from "../common/ThemeToggle";
import {
  currentFilesLocation,
  readTrashReturnTarget,
  rememberTrashReturnTarget,
} from "../../utils/trashReturnTarget";
import { rememberSettingsReturnTarget } from "../../utils/settingsReturnTarget";
import { rememberActivityReturnTarget } from "../../utils/activityReturnTarget";

interface NavBarProps {
  title?: string;
  backTo?: { path: string; label: string };
  username?: string | null;
  onLogout: () => void;
  extra?: React.ReactNode;
  showSettings?: boolean;
}

const navButtonClass =
  "neu-raised-sm nav-btn inline-flex items-center justify-center whitespace-nowrap nav-ui-fluid font-semibold tracking-wide text-[var(--nav-btn-text)] transition-[box-shadow,color,transform] duration-200 active:translate-y-px active:shadow-[var(--neu-pressed-shadow)]";

export default function NavBar({
  title = APP_NAME,
  backTo,
  username,
  onLogout,
  extra,
  showSettings = true,
}: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const filesLocation = currentFilesLocation(location.pathname, location.search);
  const currentLocation = `${location.pathname}${location.search}`;

  useEffect(() => {
    rememberTrashReturnTarget(filesLocation);
    rememberSettingsReturnTarget(location.pathname, location.search);
    rememberActivityReturnTarget(location.pathname, location.search);
  }, [filesLocation, location.pathname, location.search]);

  const navigateIfChanged = (target: string, options?: NavigateOptions) => {
    if (currentLocation === target) return;
    navigate(target, options);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav
      className={cn(
        "neu-raised nav-surface-shell fixed inset-x-0 top-0 z-50 overflow-visible pt-[env(safe-area-inset-top)]"
      )}
      onDoubleClick={handleDoubleClick}
      data-oid="2f5wd3k"
    >
      <div
        className="mx-auto max-w-[var(--app-shell-max-width)] px-[clamp(1rem,2.5vw,2rem)]"
        data-oid="q:y39os"
      >
        <div
          className="flex justify-between items-center h-[clamp(4.75rem,7.6vw,6.25rem)]"
          data-oid="qlp0jdz"
        >
          <div className="flex min-w-0 items-center gap-[clamp(0.75rem,2vw,1rem)]" data-oid="trr68n.">
            {backTo && (
              <button
                type="button"
                onClick={() => navigate(backTo.path)}
                className={navButtonClass}
                aria-label={backTo.label}
                title={backTo.label}
                data-oid="ao_vrim"
              >
                <ArrowLeft
                  className="nav-icon shrink-0 text-[var(--nav-btn-icon)]"
                  aria-hidden="true"
                  data-oid="-00ebq2"
                />

                <span
                  className="hidden sm:inline whitespace-nowrap"
                  data-oid="9cfh85y"
                >
                  {backTo.label}
                </span>
              </button>
            )}

            <div className="flex min-w-0 items-center gap-[clamp(0.75rem,2vw,1rem)]" data-oid="iqbhzo8">
              <button
                type="button"
                onClick={() => navigateIfChanged("/files")}
                aria-label="Home"
                title="Home"
                className="shrink-0 cursor-pointer select-none border-0 bg-transparent p-0 text-[var(--nav-title-text)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nav-btn-border-hover)]"
                data-oid="mtnbm56"
              >
                <CyberPrismLogo
                  className="h-[clamp(2.6rem,4vw,3.3rem)] w-[clamp(2.6rem,4vw,3.3rem)]"
                  data-oid="b:z042i"
                />
              </button>
              <h1
                className="nav-title-fluid nav-brand-title truncate select-none"
                data-oid="m354-f5"
              >
                {title}
              </h1>
            </div>
          </div>

          <div
            className="flex items-center gap-[clamp(0.375rem,1vw,0.5rem)]"
            data-oid=".t1_g6i"
          >
            {extra}

            {/* 右侧“控制面板” */}
            <div
              className={cn(
                "neu-inset nav-panel relative flex shrink-0 items-center overflow-visible",
              )}
              data-testid="nav-panel"
              data-oid="grfmuct"
            >
              {username != null && (
                <div
                  className={cn(
                    "neu-inset nav-chip hidden items-center text-[var(--nav-chip-text)] sm:flex",
                  )}
                  title={username}
                  data-oid="s_n1clb"
                >
                  <span
                    className="nav-dot bg-[var(--nav-user-dot-bg)] shadow-[var(--nav-user-dot-shadow)]"
                    data-oid="t.9r114"
                  />

                  <span
                    className="nav-ui-fluid font-brand font-semibold tracking-wider"
                    data-oid="6-k5bin"
                  >
                    {username}
                  </span>
                </div>
              )}

              {showSettings && (
                <button
                  type="button"
                  onClick={() => navigateIfChanged("/activity")}
                  aria-label="Activity"
                  title="Activity"
                  className={navButtonClass}
                  data-oid="activity-nav"
                >
                  <ListChecks
                    className="nav-icon shrink-0 text-[var(--nav-btn-icon)]"
                    aria-hidden="true"
                  />

                  <span className="hidden sm:inline whitespace-nowrap">Activity</span>
                </button>
              )}

              {showSettings && (
                <button
                  type="button"
                  onClick={() => navigateIfChanged("/settings")}
                  aria-label="Settings"
                  className={navButtonClass}
                  data-oid="p:eh6bw"
                >
                  <Settings
                    className="nav-icon shrink-0 text-[var(--nav-btn-icon)]"
                    aria-hidden="true"
                    data-oid="s8j_75m"
                  />

                  <span
                    className="hidden sm:inline whitespace-nowrap"
                    data-oid="gf_rv:m"
                  >
                    Settings
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const returnTo = filesLocation ?? readTrashReturnTarget() ?? "/files";
                  rememberTrashReturnTarget(returnTo);
                  navigateIfChanged("/trash", {
                    state: { from: returnTo },
                  });
                }}
                aria-label="Trash"
                title="Trash"
                className={navButtonClass}
                data-oid="trash-nav"
              >
                <Trash2
                  className="nav-icon shrink-0 text-[var(--nav-btn-icon)]"
                  aria-hidden="true"
                />

                <span className="hidden sm:inline whitespace-nowrap">Trash</span>
              </button>

              <ThemeToggle showLabel data-oid="zsuxs6n" />

              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                className={`${navButtonClass} font-brand`}
                data-oid="0-jtd0c"
              >
                <LogOut
                  className="nav-icon shrink-0 text-[var(--nav-btn-icon-danger)]"
                  aria-hidden="true"
                  data-oid="jlxbevw"
                />

                <span
                  className="hidden sm:inline whitespace-nowrap"
                  data-oid="bhas7u6"
                >
                  Logout
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
