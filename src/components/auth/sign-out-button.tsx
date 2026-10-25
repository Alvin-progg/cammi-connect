import { signOutAction } from "@/server/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft motion-reduce:transition-none"
      >
        Sign out
      </button>
    </form>
  );
}
