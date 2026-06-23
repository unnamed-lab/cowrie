import type { NextConfig } from "next";

/**
 * The Zama relayer SDK ships WebAssembly and is browser-only. We:
 *  - enable async WebAssembly so the WASM loads via the webpack pipeline,
 *  - transpile the workspace `@cowrie/shared` TS package,
 *  - neutralise optional peer deps that wagmi's connector barrel references but
 *    we never use (we only use the injected connector), so dev/build output is
 *    clean instead of spammed with harmless "module not found" warnings.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@cowrie/shared"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Optional deps referenced behind feature checks; resolve them to nothing.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Upstream noise from viem/ox dynamic requires and the SDK's WASM chunking.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { message: /Critical dependency: the request of a dependency is an expression/ },
      { message: /Can't resolve '@react-native-async-storage\/async-storage'/ },
      { message: /Can't resolve 'pino-pretty'/ },
    ];

    return config;
  },
};

export default nextConfig;
