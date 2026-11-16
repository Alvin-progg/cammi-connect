import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatShell } from "@/components/chat/chat-shell";
import type { PatientAppointment } from "@/lib/appointments/types";
import type { BookedPayment, ChatMessage } from "@/lib/chat/schemas";

const mocks = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/server/appointments/actions", () => ({ cancelPatientAppointmentAction: vi.fn() }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess, dismiss: vi.fn() },
}));

const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
const PAYMENT_ID = "00000000-0000-4000-8000-00000000a001";
const QR = { imageSrc: "/payment/qr-synthetic-demo.svg", accountName: "CamiConnect Hospital" };
const PAYMENT: BookedPayment = {
  id: PAYMENT_ID,
  method: "qr_ph",
  status: "awaiting_payment",
  amountDueCentavos: 56000,
  referenceCode: "CC-7F3K2",
  deadline: "2026-11-17T08:30:00.000Z",
};
const RESULT: ChatMessage = {
  id: "m1",
  role: "assistant",
  content: "Almost done!",
  createdAt: "2026-11-17T01:00:00.000Z",
  payload: {
    kind: "booking_result",
    doctorName: "Dr. Maya Santos",
    start: "2026-11-18T01:00:00.000Z",
    end: "2026-11-18T01:30:00.000Z",
    payment: PAYMENT,
  },
};
const UPCOMING: PatientAppointment = {
  id: "appointment-1",
  doctorName: "Dr. Maya Santos",
  departmentName: "Cardiology",
  reason: null,
  scheduledAt: "2026-11-18T01:00:00.000Z",
  durationMinutes: 30,
  status: "requested",
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderChat(paymentQr: { imageSrc: string | null; accountName: string } | null, payment: BookedPayment = PAYMENT) {
  const message = { ...RESULT, payload: { ...RESULT.payload, payment } } as ChatMessage;
  return render(
    <ChatShell
      salutation="Good Morning"
      firstName="Ana"
      welcomeMessage="Welcome"
      patientName="Ana Dela Cruz"
      conversations={[]}
      conversationId={CONVERSATION_ID}
      initialMessages={[message]}
      appointments={null}
      paymentQr={paymentQr}
    />,
  );
}

const jpeg = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "receipt.jpg", { type: "image/jpeg" });

describe("PAY-04 QR card in chat", () => {
  it("shows the QR, account name, amount, reference code, and deadline", () => {
    renderChat(QR);

    const card = screen.getByRole("group", { name: "Payment" });
    const qr = within(card).getByRole("img", { name: /QR Ph code/ });
    expect(qr).toHaveAttribute("src", QR.imageSrc);
    expect(within(card).getByText("CamiConnect Hospital")).toBeInTheDocument();
    expect(within(card).getByText("₱560.00")).toBeInTheDocument();
    expect(within(card).getByText("CC-7F3K2")).toBeInTheDocument();
    expect(within(card).getByText("Pay by")).toBeInTheDocument();
  });

  it("falls back to paying at the hospital when no QR is configured", () => {
    renderChat({ imageSrc: null, accountName: "" });

    const card = screen.getByRole("group", { name: "Payment" });
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).getByText(/QR code isn't set up yet/)).toBeInTheDocument();
    expect(within(card).queryByLabelText(/Photo of your receipt/)).not.toBeInTheDocument();
  });

  it("offers no QR or upload for a counter payment", () => {
    renderChat(QR, { ...PAYMENT, method: "counter" });

    const card = screen.getByRole("group", { name: "Payment" });
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).queryByLabelText(/Photo of your receipt/)).not.toBeInTheDocument();
  });

  it("uploads the receipt to the payment's route and shows Cami's reply", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        payment: { status: "submitted" },
        message: {
          id: "m2",
          role: "assistant",
          content: "Got your receipt, thank you! The front desk will check it and I'll let you know here.",
          payload: null,
          createdAt: "2026-11-17T01:05:00.000Z",
        },
      }),
    );
    renderChat(QR);

    const input = screen.getByLabelText(/Photo of your receipt/);
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    fireEvent.change(input, { target: { files: [jpeg()] } });
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));

    await waitFor(() => expect(screen.getByText(/Got your receipt/)).toBeInTheDocument());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/v1/payments/${PAYMENT_ID}/receipt`);
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("receipt")).toBeInstanceOf(File);
    expect(body.get("conversationId")).toBe(CONVERSATION_ID);
    expect(screen.getByText("Receipt sent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send receipt" })).not.toBeInTheDocument();
  });

  it("shows the server's fixed message when the upload is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { code: "unsupported_type", message: "Please send a JPEG, PNG, or WebP photo." } },
        { status: 415 },
      ),
    );
    renderChat(QR);

    fireEvent.change(screen.getByLabelText(/Photo of your receipt/), { target: { files: [jpeg()] } });
    fireEvent.click(screen.getByRole("button", { name: "Send receipt" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(mocks.toastError.mock.calls[0][1]).toEqual({
      id: "receipt-upload-error",
      description: "Please send a JPEG, PNG, or WebP photo.",
    });
    expect(screen.getByRole("button", { name: "Send receipt" })).toBeInTheDocument();
  });
});

describe("PAY-04 pay later in My appointments", () => {
  it("shows the payment card under an unpaid upcoming appointment", () => {
    render(
      <ChatShell
        salutation="Good Morning"
        firstName="Ana"
        welcomeMessage="Welcome"
        patientName="Ana Dela Cruz"
        conversations={[]}
        conversationId={null}
        initialMessages={[]}
        appointments={{ upcoming: [UPCOMING], past: [], payments: { [UPCOMING.id]: PAYMENT } }}
        paymentQr={QR}
      />,
    );

    const upcoming = screen.getByRole("region", { name: "Upcoming" });
    const card = within(upcoming).getByRole("group", { name: "Payment" });
    expect(within(card).getByText("CC-7F3K2")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /QR Ph code/ })).toBeInTheDocument();
    expect(within(card).getByLabelText(/Photo of your receipt/)).toBeInTheDocument();
  });
});
