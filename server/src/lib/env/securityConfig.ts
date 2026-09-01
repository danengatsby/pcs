import { parseTrustProxy, type TrustProxyValue } from "../trustProxy.js";
import { readBooleanFlag } from "./shared.js";

export function readForceHttpsUpgrade(): boolean {
  return readBooleanFlag(process.env.FORCE_HTTPS_UPGRADE, false);
}

export function readTrustProxy(): TrustProxyValue {
  return parseTrustProxy(process.env.TRUST_PROXY, false);
}
