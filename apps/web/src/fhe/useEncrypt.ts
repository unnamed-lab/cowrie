"use client";

import { getFheInstance } from "./instance";

/**
 * Encrypt a uint64 amount bound to (contractAddress, userAddress) and return the
 * ciphertext handle + zero-knowledge input proof to pass to a contract call.
 *
 * The binding to (contract, user) is what lets the contract verify the input was
 * produced for this exact call — you cannot replay someone else's ciphertext.
 */
export async function encryptAmount(
  contractAddress: string,
  userAddress: string,
  amount: bigint,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const instance = await getFheInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(amount);
  const { handles, inputProof } = await input.encrypt();

  const toHex = (b: Uint8Array): `0x${string}` =>
    `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;

  return {
    handle: toHex(handles[0]),
    inputProof: toHex(inputProof),
  };
}
