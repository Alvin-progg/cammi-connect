import { SpinnerIcon } from "./auth-icons";

/** Full-width primary submit for the auth forms; blocks double submission. */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="focus-ring mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-ink shadow-card transition-[background-color,transform] duration-150 ease-snappy hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70 motion-reduce:transition-none"
    >
      {pending ? (
        <SpinnerIcon className="size-4 motion-safe:animate-spin" />
      ) : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
