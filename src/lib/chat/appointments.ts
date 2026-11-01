/** Server-written replies for viewing and cancelling appointments in chat (AI-APT-001 S4). */
export const APPOINTMENTS_COPY = {
  list: "Here are your upcoming appointments. Times are in Philippine time.",
  chooseToCancel: "Which appointment would you like to cancel?",
  none: "You have no upcoming appointments. Would you like to book one?",
  confirmCancel: "Please confirm that you want to cancel this appointment.",
  cancelled: "Your appointment has been cancelled.",
  rescheduleUnavailable:
    "Rescheduling isn't available yet. You can cancel your appointment and book a new time instead.",
} as const;
