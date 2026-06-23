"use client";

import { getFheInstance } from "./instance";

/**
 * Public decryption for the Crowdfund reveal. Fetches the cleartext plus the
 * KMS-signed proof for a publicly-decryptable handle. The returned
 * `abiEncodedClearValues` and `decryptionProof` are exactly the two `bytes`
 * arguments that `Crowdfund.settle(cleartexts, proof)` feeds to
 * `FHE.checkSignatures` on-chain.
 */
export async function publicDecryptReached(handle: string): Promise<{
  reached: boolean;
  cleartexts: `0x${string}`;
  decryptionProof: `0x${string}`;
}> {
  const instance = await getFheInstance();
  const result = await instance.publicDecrypt([handle]);

  return {
    reached: Boolean(result.clearValues[handle as keyof typeof result.clearValues]),
    cleartexts: result.abiEncodedClearValues,
    decryptionProof: result.decryptionProof,
  };
}
