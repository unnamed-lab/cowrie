"use client";

// The Zama relayer SDK browser build references browser globals (`self`, WASM) at
// module load, so it must never be imported during SSR/prerender. We therefore
// load it via a dynamic import inside the function (runs only in the browser) and
// use a type-only import for the instance type (erased at compile time).
type SdkModule = typeof import("@zama-fhe/relayer-sdk/web");
type FheInstance = Awaited<ReturnType<SdkModule["createInstance"]>>;

let _instance: FheInstance | null = null;
let _initPromise: Promise<FheInstance> | null = null;

/**
 * Lazily initialise the Zama relayer SDK once per browser session.
 *
 * `initSDK()` loads the WASM (TFHE) bundle and MUST resolve before
 * `createInstance`. `SepoliaConfig` bundles the ACL / KMS / relayer addresses for
 * the Zama protocol on Sepolia; it omits `network`, so we supply the injected
 * wallet provider (falling back to a public Sepolia RPC).
 */
export function getFheInstance(): Promise<FheInstance> {
  if (_instance) return Promise.resolve(_instance);
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
    await initSDK(); // load WASM

    type Network = Parameters<typeof createInstance>[0]["network"];
    const injected =
      typeof window !== "undefined" ? (window as unknown as { ethereum?: Network }).ethereum : undefined;

    const instance = await createInstance({
      ...SepoliaConfig,
      network: injected ?? "https://ethereum-sepolia-rpc.publicnode.com",
    });
    _instance = instance;
    return instance;
  })();

  return _initPromise;
}
