import type { NextConfig } from "next";

/**
 * The Zama relayer SDK ships WebAssembly and is browser-only. We:
 *  - enable async WebAssembly so the WASM loads via the webpack pipeline,
 *  - transpile the workspace `@cowrie/shared` TS package,
 *  - keep the SDK out of any server bundle (it's only imported in client code).
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@cowrie/shared"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // The SDK references these Node built-ins behind feature checks in the browser build.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
