export const WOMPI_PROVIDER = "wompi";
export const WOMPI_SANDBOX_ENVIRONMENT = "sandbox";
export const WOMPI_PREMIUM_PRODUCT_CODE = "predigol-premium-30d";
export const WOMPI_PREMIUM_AMOUNT_IN_CENTS = 2000000;
export const WOMPI_PREMIUM_CURRENCY = "COP";

const encoder = new TextEncoder();

export type WompiTransactionStatus =
  | "APPROVED"
  | "DECLINED"
  | "VOIDED"
  | "ERROR"
  | "PENDING";

export type InternalPaymentStatus =
  | "approved"
  | "declined"
  | "voided"
  | "error"
  | "pending";

export type WompiTransaction = {
  id?: string;
  reference?: string;
  amount_in_cents?: number;
  currency?: string;
  status?: WompiTransactionStatus | string;
  environment?: string;
};

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string) {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", encoder.encode(input)),
  );
}

export function generateIntegritySignature({
  reference,
  amountInCents,
  currency,
  integritySecret,
}: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}) {
  if (
    !reference || !Number.isInteger(amountInCents) || amountInCents <= 0 ||
    !currency || !integritySecret
  ) {
    throw new Error("Invalid Wompi integrity signature input.");
  }

  return sha256Hex(`${reference}${amountInCents}${currency}${integritySecret}`);
}

function timingSafeEqual(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export function getNestedValue(input: unknown, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }

    return undefined;
  }, input);
}

export async function verifyWompiEventSignature(
  payload: unknown,
  eventsSecret: string,
) {
  const event = payload as Record<string, unknown>;
  const signature = event?.signature as Record<string, unknown> | undefined;
  const properties = Array.isArray(signature?.properties)
    ? signature.properties.map(String)
    : [];
  const checksum = typeof signature?.checksum === "string"
    ? signature.checksum
    : "";
  const timestamp = event?.timestamp;

  if (
    !eventsSecret || properties.length === 0 || !checksum ||
    timestamp === undefined || timestamp === null
  ) {
    return false;
  }

  const values = properties.map((property) => {
    const value = getNestedValue(payload, property);
    return value === undefined || value === null ? "" : String(value);
  });
  const expected = await sha256Hex(
    `${values.join("")}${timestamp}${eventsSecret}`,
  );

  return timingSafeEqual(expected, checksum);
}

export function mapWompiStatus(
  status: string | undefined | null,
): InternalPaymentStatus {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "DECLINED":
      return "declined";
    case "VOIDED":
      return "voided";
    case "ERROR":
      return "error";
    default:
      return "pending";
  }
}

export function getWompiTransaction(payload: unknown): WompiTransaction {
  const event = payload as Record<string, unknown>;
  const data = event?.data as Record<string, unknown> | undefined;
  const transaction = data?.transaction as WompiTransaction | undefined;
  return transaction || {};
}

export function assertApprovedTransactionMatchesOrder(
  transaction: WompiTransaction,
  order: {
    reference: string;
    amount_in_cents: number;
    currency: string;
    environment: string;
  },
) {
  if (transaction.reference !== order.reference) {
    throw new Error("Wompi reference mismatch.");
  }

  if (transaction.amount_in_cents !== order.amount_in_cents) {
    throw new Error("Wompi amount mismatch.");
  }

  if (transaction.currency !== order.currency) {
    throw new Error("Wompi currency mismatch.");
  }

  if (
    transaction.environment && transaction.environment !== order.environment
  ) {
    throw new Error("Wompi environment mismatch.");
  }
}

export function buildWompiCheckoutUrl({
  checkoutBaseUrl,
  publicKey,
  currency,
  amountInCents,
  reference,
  redirectUrl,
  signature,
}: {
  checkoutBaseUrl: string;
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  redirectUrl?: string;
  signature: string;
}) {
  const url = new URL(checkoutBaseUrl);
  url.searchParams.set("public-key", publicKey);
  url.searchParams.set("currency", currency);
  url.searchParams.set("amount-in-cents", String(amountInCents));
  url.searchParams.set("reference", reference);
  url.searchParams.set("signature:integrity", signature);

  if (redirectUrl) {
    url.searchParams.set("redirect-url", redirectUrl);
  }

  return url.toString();
}

export function buildPaymentReference(
  userId: string,
  orderId: string,
  now = new Date(),
) {
  const userPart = userId.replace(/-/g, "").slice(0, 12);
  const orderPart = orderId.replace(/-/g, "").slice(0, 12);
  const datePart = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `predigol-${WOMPI_SANDBOX_ENVIRONMENT}-${datePart}-${userPart}-${orderPart}`;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
