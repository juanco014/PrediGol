import {
  assertApprovedTransactionMatchesOrder,
  buildPaymentReference,
  buildWompiCheckoutUrl,
  generateIntegritySignature,
  mapWompiStatus,
  sha256Hex,
  verifyWompiEventSignature,
} from "./wompi.ts";

Deno.test("generateIntegritySignature uses Wompi approved concatenation", async () => {
  const signature = await generateIntegritySignature({
    reference: "predigol-test-reference",
    amountInCents: 2000000,
    currency: "COP",
    integritySecret: "test_integrity_secret",
  });
  const expected = await sha256Hex(
    "predigol-test-reference2000000COPtest_integrity_secret",
  );

  if (signature !== expected) {
    throw new Error("Unexpected integrity signature.");
  }
});

Deno.test("verifyWompiEventSignature checks property list and timestamp", async () => {
  const secret = "test_events_secret";
  const payload = {
    event: "transaction.updated",
    timestamp: 1710000000,
    data: {
      transaction: {
        id: "tx_test",
        status: "APPROVED",
        amount_in_cents: 2000000,
      },
    },
    signature: {
      properties: [
        "data.transaction.id",
        "data.transaction.status",
        "data.transaction.amount_in_cents",
      ],
      checksum: "",
    },
  };
  payload.signature.checksum = await sha256Hex(
    "tx_testAPPROVED20000001710000000test_events_secret",
  );

  if (!(await verifyWompiEventSignature(payload, secret))) {
    throw new Error("Expected event signature to be valid.");
  }
});

Deno.test("mapWompiStatus keeps only approved as approved", () => {
  if (mapWompiStatus("APPROVED") !== "approved") {
    throw new Error("APPROVED should map to approved.");
  }
  if (mapWompiStatus("DECLINED") !== "declined") {
    throw new Error("DECLINED should map to declined.");
  }
  if (mapWompiStatus("PENDING") !== "pending") {
    throw new Error("PENDING should map to pending.");
  }
  if (mapWompiStatus(undefined) !== "pending") {
    throw new Error("Missing status should map to pending.");
  }
});

Deno.test("assertApprovedTransactionMatchesOrder rejects mismatched amount", () => {
  let failed = false;

  try {
    assertApprovedTransactionMatchesOrder(
      {
        reference: "ref",
        amount_in_cents: 1000,
        currency: "COP",
        environment: "sandbox",
      },
      {
        reference: "ref",
        amount_in_cents: 2000000,
        currency: "COP",
        environment: "sandbox",
      },
    );
  } catch {
    failed = true;
  }

  if (!failed) throw new Error("Expected amount mismatch to fail.");
});

Deno.test("buildWompiCheckoutUrl includes amount-in-cents and signature", () => {
  const url = buildWompiCheckoutUrl({
    checkoutBaseUrl: "https://checkout.wompi.co/p/",
    publicKey: "pub_test_placeholder",
    currency: "COP",
    amountInCents: 2000000,
    reference: "ref_test",
    redirectUrl: "https://predigol.test/pagos/retorno",
    signature: "sig_test",
  });

  if (!url.includes("amount-in-cents=2000000")) {
    throw new Error("Missing amount-in-cents.");
  }
  if (!url.includes("signature%3Aintegrity=sig_test")) {
    throw new Error("Missing integrity signature.");
  }
});

Deno.test("buildPaymentReference creates sandbox scoped references", () => {
  const reference = buildPaymentReference(
    "11111111-2222-3333-4444-555555555555",
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    new Date("2026-07-15T12:34:56.000Z"),
  );

  if (!reference.startsWith("predigol-sandbox-20260715123456-")) {
    throw new Error("Expected sandbox reference prefix.");
  }
});
