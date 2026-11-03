import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "@/components/front-desk/table-frame";
import { buttonVariants } from "@/components/ui/button";
import { formatManilaDateTime, formatManilaShortDate } from "@/lib/appointments/format";
import { USER_ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles";
import type { AdminUserRow, UserListFilters } from "@/lib/users/types";

const USERS_PATH = "/admin/users";
const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";

/** The users list URL for a page, keeping the active filters. */
function usersListHref(filters: UserListFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${USERS_PATH}?${query}` : USERS_PATH;
}

/** GET form, so filters live in the URL and survive reloads and sharing. */
export function UsersFilters({ filters }: { filters: UserListFilters }) {
  return (
    <form
      role="search"
      aria-label="Filter accounts"
      method="get"
      action={USERS_PATH}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1 sm:flex-none">
        <label htmlFor="users-search" className={FIELD_LABEL_CLASS}>
          Search
        </label>
        <input
          id="users-search"
          name="q"
          type="search"
          defaultValue={filters.search}
          placeholder="Name or email"
          maxLength={100}
          className={CONTROL_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="users-role" className={FIELD_LABEL_CLASS}>
          Role
        </label>
        <select id="users-role" name="role" defaultValue={filters.role ?? ""} className={CONTROL_CLASS}>
          <option value="">All roles</option>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="users-status" className={FIELD_LABEL_CLASS}>
          Status
        </label>
        <select
          id="users-status"
          name="status"
          defaultValue={filters.status ?? ""}
          className={CONTROL_CLASS}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <button type="submit" className={buttonVariants({ variant: "secondary" })}>
        Filter
      </button>
    </form>
  );
}

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? "bg-success-soft text-success-soft-ink" : "bg-surface-muted text-ink-secondary"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function UsersTable({
  users,
  total,
  page,
  pageCount,
  filters,
}: {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
  filters: UserListFilters;
}) {
  if (users.length === 0) {
    return <EmptyState>No accounts match these filters.</EmptyState>;
  }

  const linkClass =
    "rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">{total === 1 ? "1 account" : `${total} accounts`}</p>
      <TableFrame label="Accounts" minWidthClass="min-w-[52rem]">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL}>Name</th>
            <th scope="col" className={HEADER_CELL}>Email</th>
            <th scope="col" className={HEADER_CELL}>Role</th>
            <th scope="col" className={HEADER_CELL}>Status</th>
            <th scope="col" className={HEADER_CELL}>Created</th>
            <th scope="col" className={HEADER_CELL}>Last sign-in</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={ROW}>
              <td className={CELL}>
                <Link href={`${USERS_PATH}/${user.id}`} className={linkClass}>
                  {user.fullName}
                </Link>
              </td>
              <td className={`${CELL} break-all`}>{user.email ?? "Not provided"}</td>
              <td className={CELL}>{USER_ROLE_LABELS[user.role]}</td>
              <td className={CELL}>
                <UserStatusBadge isActive={user.isActive} />
              </td>
              <td className={CELL}>{formatManilaShortDate(user.createdAt)}</td>
              <td className={CELL}>
                {user.lastSignInAt ? formatManilaDateTime(user.lastSignInAt) : "Never"}
              </td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
      <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-secondary">{`Page ${page} of ${pageCount}`}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={usersListHref(filters, page - 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Previous page
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={usersListHref(filters, page + 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Next page
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
