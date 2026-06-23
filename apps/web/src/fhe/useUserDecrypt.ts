"use client";

import { getFheInstance } from "./instance";

export type TypedDataSigner = {
  address: string;
  signTypedData: (args: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<string>;
};

/**
 * EIP-712 user decryption: prove (via the ACL) you're allowed to read a handle,
 * fetch it re-encrypted under an ephemeral key, decrypt it locally.
 *
 * Flow: generate keypair -> sign an EIP-712 grant -> userDecrypt. The shape is
 * stable across SDK versions even when individual argument lists move; if this
 * breaks after an SDK bump, re-check the "User decryption" docs page.
 */
export async function decryptHandle(
  handle: string,
  contractAddress: string,
  signer: TypedDataSigner,
): Promise<bigint | boolean> {
  const instance = await getFheInstance();
  const keypair = instance.generateKeypair();

  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 7;
  const contracts = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contracts, startTimestamp, durationDays);

  const signature = await signer.signTypedData({
    domain: eip712.domain as Record<string, unknown>,
    types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message as Record<string, unknown>,
  });

  const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contracts,
    signer.address,
    startTimestamp,
    durationDays,
  );

  return result[handle as `0x${string}`] as bigint | boolean;
}
