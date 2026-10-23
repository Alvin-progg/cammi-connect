export type FieldErrors = Partial<
  Record<"fullName" | "email" | "password" | "confirmPassword", string[]>
>;

export type AuthFormState = {
  fieldErrors?: FieldErrors;
  formError?: string;
  success?: string;
};
