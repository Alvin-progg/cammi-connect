import { SparkleIcon } from "./icons";

/** Shown instead of the chat while an admin has turned Cami off (`chatbot.enabled`). */
export function ChatMaintenance({ contactPhone }: { contactPhone: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-card">
        <SparkleIcon className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-medium tracking-tight text-ink text-balance">
        Cami is offline for maintenance
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-secondary">
        {contactPhone ? (
          <>
            For appointments and questions, please call the hospital front desk at{" "}
            <a
              href={`tel:${contactPhone.replace(/\s+/g, "")}`}
              className="focus-ring font-medium text-accent underline-offset-2 hover:underline"
            >
              {contactPhone}
            </a>
            .
          </>
        ) : (
          "For appointments and questions, please contact the hospital front desk."
        )}
      </p>
    </div>
  );
}
