/** Server-written replies for viewing and cancelling appointments in chat (AI-APT-001 S4). */
export const APPOINTMENTS_COPY = {
  list: "Here are your upcoming appointments. Times are in Philippine time.",
  chooseToCancel: "Which appointment would you like to cancel?",
  none: "You don't have any upcoming appointments. Would you like me to help you book one?",
  confirmCancel: "Just to be sure, please confirm that you want to cancel this appointment.",
  cancelled: "Your appointment has been cancelled. If you'd like, I can help you book a new one.",
  rescheduleUnavailable:
    "I'm sorry, rescheduling isn't available yet. You can cancel your appointment and I'll help you book a new time instead.",
} as const;
