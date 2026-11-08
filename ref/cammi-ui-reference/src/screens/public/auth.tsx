import { Eye, KeyRound, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, Card, CardHeader, DetailList, IconTile } from "@/components/ui/card";
import { ListRow, ListRows } from "@/components/ui/data";
import { Field, Input } from "@/components/ui/field";
import { href } from "@/lib/routes";

const TALL = "h-11";

function AuthTopBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-6 pt-6">
      <a href={href("/")} className="focus-ring flex items-center gap-2.5 rounded-lg">
        <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-ink">C</span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">CamiConnect</span>
      </a>
      <LinkButton variant="ghost" size="sm" href={href("/")}>
        Back to home
      </LinkButton>
    </header>
  );
}

/** Shared auth frame: soft page, top bar, centred content, disclaimer. */
function AuthFrame({ children, footnote }: { children: ReactNode; footnote?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f9fd] text-ink">
      <AuthTopBar />
      <main className="flex flex-1 items-center justify-center px-4 pb-6 pt-8">
        <div className="flex w-full max-w-[960px] flex-col items-center gap-5">
          {children}
          {footnote ? <p className="text-center text-xs text-ink-muted">{footnote}</p> : null}
        </div>
      </main>
    </div>
  );
}

function PasswordInput({ id, value, autoComplete, invalid, describedBy }: { id: string; value: string; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  return (
    <div className="relative">
      <Input id={id} type="password" defaultValue={value} autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={`${TALL} pr-11`} />
      <button type="button" aria-label="Show password" aria-pressed={false} className="focus-ring absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink">
        <Eye aria-hidden className="size-4.5" />
      </button>
    </div>
  );
}

/**
 * /login — shadcn two-column login block. No React Bits here: the existing
 * nurse mascot (MascotStage) is the motion. Show the error state with the
 * Alert (destructive) above the fields, same message for every failure.
 */
export function LoginScreen() {
  return (
    <AuthFrame footnote="Cami's answers are AI-generated and not medical advice. By signing in you agree to the hospital's [TERMS] and [PRIVACY NOTICE].">
      <div className="grid w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-lift md:grid-cols-2">
        <form className="flex flex-col gap-5.5 px-8 py-12 sm:px-11">
          <div className="text-center">
            <h1 className="text-[26px] font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-ink-secondary">Sign in to your CamiConnect account</p>
          </div>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue="juan.delacruz@example.com" className={TALL} />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            labelAction={
              <a href={href("/account/password")} className="text-[13px] text-primary underline-offset-4 hover:underline">
                Forgot your password?
              </a>
            }
          >
            <PasswordInput id="password" value="password123" autoComplete="current-password" />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
          <p className="flex items-center gap-3 text-xs text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</p>
          <LinkButton variant="outline" size="lg" href={href("/register")} className="w-full">
            Create a patient account
          </LinkButton>
          <p className="text-center text-xs leading-[18px] text-ink-muted">Staff accounts are created by an administrator. Check your invite email to set your password.</p>
        </form>

        <aside aria-hidden className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden border-l border-line bg-[linear-gradient(160deg,#e0f2fe_0%,#e9f1ff_50%,#f7f9fd_100%)] px-9 py-10 md:flex">
          <div className="bg-grid-soft absolute inset-0" />
          <div className="relative">
            <Badge tone="ai" className="bg-surface">
              Cami · AI assistant
            </Badge>
            <p className="mt-3.5 max-w-80 text-2xl font-semibold leading-tight tracking-tight">Ask about services or request an appointment in a few messages.</p>
          </div>
          {/* In the repo: <MascotStage> + <NurseMascot> (src/components/auth). This PNG is its front frame. */}
          <div className="relative flex items-end">
            <img src="/nurse-front.png" alt="" width={260} height={260} className="-mb-16 -ml-7 size-[260px] object-contain" />
            <div className="-ml-9 mb-[150px] max-w-[220px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-2.5 shadow-[0_12px_24px_-16px_rgb(15_35_66/0.35)]">
              <p className="text-sm font-medium">Good to see you again!</p>
              <p className="text-xs text-ink-muted">I'll look away while you type your password.</p>
            </div>
          </div>
        </aside>
      </div>
    </AuthFrame>
  );
}

/** /register — single card, same frame as sign in. */
export function RegisterScreen() {
  return (
    <AuthFrame footnote="Already have an account? Sign in from the top of the page.">
      <form className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-line bg-surface p-8 shadow-lift">
        <div>
          <p className="text-sm font-medium text-primary">New patient</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-ink-secondary">Use your own details so the hospital can reach you about appointments.</p>
        </div>
        {/* Same fields as RegisterForm: fullName, email, password, confirmPassword. */}
        <div className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="rname">
            <Input id="rname" autoComplete="name" defaultValue="Juan Dela Cruz" className={TALL} />
          </Field>
          <Field label="Email" htmlFor="remail">
            <Input id="remail" type="email" autoComplete="email" defaultValue="juan.delacruz@example.com" className={TALL} />
          </Field>
          <Field label="Password" htmlFor="rpw" hint="At least 8 characters.">
            <PasswordInput id="rpw" value="abcdefgh" autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" htmlFor="rpw2">
            <PasswordInput id="rpw2" value="abcdefgh" autoComplete="new-password" />
          </Field>
        </div>
        <p className="text-xs text-ink-muted">Cami's answers are AI-generated and not medical advice. Your chat messages are stored to run the service.</p>
        <Button type="submit" size="lg">
          Create account
        </Button>
      </form>
    </AuthFrame>
  );
}

/** /account/password — invite and reset land here (via /auth/confirm). */
export function SetPasswordScreen() {
  return (
    <AuthFrame>
      <form className="flex w-full max-w-[448px] flex-col gap-5 rounded-2xl border border-line bg-surface p-8 shadow-lift">
        <div>
          <IconTile>
            <KeyRound aria-hidden />
          </IconTile>
          <h1 className="mt-3.5 text-[26px] font-semibold tracking-tight">Set your password</h1>
          <p className="mt-1 text-ink-secondary">Choose a password to finish setting up your account.</p>
        </div>
        <Field label="Email" htmlFor="sp-email">
          <Input id="sp-email" defaultValue="rosa.garcia@stcamillus.example" disabled className={TALL} />
        </Field>
        <Field label="New password" htmlFor="sp1" hint="At least 8 characters.">
          <PasswordInput id="sp1" value="abcdefghij" autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" htmlFor="sp2" error="Passwords don't match." errorId="sp2-err">
          <PasswordInput id="sp2" value="abcdefgh" autoComplete="new-password" invalid describedBy="sp2-err" />
        </Field>
        <Button type="submit" size="lg">
          Save password
        </Button>
      </form>
    </AuthFrame>
  );
}

/** /account — today only a sign-out button; this gives it a real page. */
export function AccountScreen() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line px-8 py-3.5">
        <span className="text-[17px] font-semibold tracking-tight">CamiConnect</span>
        <LinkButton variant="outline" size="sm" href={href("/chat")}>
          Back to chat
        </LinkButton>
      </header>
      <div className="border-b border-line bg-wash">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-5 px-6 pb-7 pt-10">
          <Avatar initials="JD" size="lg" />
          <div>
            <p className="text-sm font-medium text-primary">Your account</p>
            <h1 className="text-3xl font-semibold tracking-tight">Juan Dela Cruz</h1>
            <p className="text-ink-secondary">Patient · juan.delacruz@example.com</p>
          </div>
        </div>
      </div>
      <main className="mx-auto flex max-w-[880px] flex-col gap-4 px-6 pb-12 pt-7">
        <Card>
          <CardHeader title="Personal details" />
          <DetailList items={[["Full name", "Juan Dela Cruz"], ["Email", "juan.delacruz@example.com"]]} />
        </Card>
        <Card>
          <CardHeader title="Security" />
          <ListRows>
            <ListRow>
              <div className="flex-1">
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-ink-muted">Send yourself a reset link to change it</p>
              </div>
              <LinkButton variant="outline" size="sm" href={href("/account/password")}>
                Change password
              </LinkButton>
            </ListRow>
            <ListRow>
              <div className="flex-1">
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-ink-muted">Signs you out on this device</p>
              </div>
              <Button variant="outlineDanger" size="sm">
                <LogOut aria-hidden />
                Sign out
              </Button>
            </ListRow>
          </ListRows>
        </Card>
        <Card>
          <CardHeader title="Chat data" />
          <p className="text-sm text-ink-secondary">Your messages are stored and sent to Google Gemini and OpenCode Zen to answer questions. Chat transcripts are not shared with hospital staff.</p>
        </Card>
      </main>
    </div>
  );
}
