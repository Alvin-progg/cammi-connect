const GENERIC_MESSAGE = "Unable to sign in right now.";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email first.",
  user_already_exists:
    "If an account can be created for this email, check your inbox.",
  weak_password: "Password does not meet the requirements.",
  over_email_send_rate_limit: "Too many attempts, try again later.",
  over_request_rate_limit: "Too many attempts, try again later.",
};

export function messageForAuthError(code: string | undefined | null): string {
  if (!code) return GENERIC_MESSAGE;
  return MESSAGES[code] ?? GENERIC_MESSAGE;
}
