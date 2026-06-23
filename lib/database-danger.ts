import type { ProjectDatabaseStatus } from "@/lib/types";

export type ProjectDatabaseListFilter = "default" | "active" | "disabled" | "archived" | "destroyed" | "all";

export function buildDestroyConfirmationText(databaseName: string) {
  return `destruir ${databaseName.trim().toLowerCase()}`;
}

export function canDestroyDatabase(status: string) {
  return status === "ACTIVE" || status === "FAILED" || status === "CREATED_MANUALLY" || status === "DISABLED";
}

export function canDisableDatabaseAccess(status: string) {
  return status === "ACTIVE" || status === "CREATED_MANUALLY";
}

export function canEnableDatabaseAccess(status: string) {
  return status === "DISABLED";
}

export function isDatabaseReadOnly(status: string) {
  return status === "DESTROYED" || status === "PARTIALLY_DESTROYED" || status === "ARCHIVED";
}

export function isDatabaseDestroyed(status: string) {
  return status === "DESTROYED" || status === "PARTIALLY_DESTROYED";
}

const ACTIVE_FILTER_STATUSES: ProjectDatabaseStatus[] = [
  "PLANNED",
  "PROVISIONING",
  "ACTIVE",
  "FAILED",
  "CREATED_MANUALLY"
];

export function matchesDatabaseListFilter(status: ProjectDatabaseStatus, filter: ProjectDatabaseListFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "default") {
    return shouldShowDatabaseByDefault(status);
  }

  if (filter === "active") {
    return ACTIVE_FILTER_STATUSES.includes(status);
  }

  if (filter === "disabled") {
    return status === "DISABLED";
  }

  if (filter === "archived") {
    return status === "ARCHIVED";
  }

  return status === "DESTROYED" || status === "PARTIALLY_DESTROYED";
}

export function defaultDatabaseListFilter(): ProjectDatabaseListFilter {
  return "default";
}

export function shouldShowDatabaseByDefault(status: ProjectDatabaseStatus) {
  return !isDatabaseDestroyed(status);
}
