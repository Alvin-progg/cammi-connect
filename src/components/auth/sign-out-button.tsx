import { signOutAction } from "@/server/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
      >
        Sign out
      </button>
    </form>
  );
}
