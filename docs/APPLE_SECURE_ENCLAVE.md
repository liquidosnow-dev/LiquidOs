# Apple Secure Enclave Integration Path (D-18)

**Status**: Design & integration specification  
**Date**: 2026-11-23  
**Related**: `docs/SOVEREIGN_SUBSTRATE.md` §2, Decision D-18

This document defines how Liquid OS / Atomic Nexus satisfies kernel-anchored identity on Apple platforms (iPadOS / iOS with A16 and later, macOS with Apple silicon).

On Linux the substrate uses `SO_PEERCRED` (effective UID 1000). On Apple platforms the functional equivalent is the **Secure Enclave** combined with **LocalAuthentication**.

---

## 1. Goals

- Device-bound, non-extractable identity key.
- User-presence / biometric proof before privileged operations.
- Optional Apple-backed app integrity (App Attest).
- Zero private key material ever leaves the Secure Enclave.
- Compatible with the 2.8 GB peak RAM envelope and Notepad Constraint.

## 2. Recommended Stack

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| Device identity | Secure Enclave P-256 signing key (`kSecAttrTokenIDSecureEnclave` or CryptoKit `SecureEnclave.P256`) | Non-exportable proof-of-possession |
| User presence | `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)` | Biometric / passcode gate |
| App integrity (optional) | `DCAppAttestService` | Apple-attested key proving genuine binary |
| Durable secrets | Keychain with strong accessibility + optional biometry ACL | Tokens, leases, capability records |

## 3. Key Generation Pattern (Swift)

```swift
import Security
import LocalAuthentication
import CryptoKit

// Preferred modern path
let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    [.privateKeyUsage, .biometryCurrentSet],
    nil
)!

let privateKey = try SecureEnclave.P256.Signing.PrivateKey(
    accessControl: access
)
// Persist only the public key / key reference; never the private material.
```

Legacy Security-framework equivalent uses `SecKeyCreateRandomKey` with `kSecAttrTokenIDSecureEnclave` and `.privateKeyUsage`.

## 4. Biometric Gate Pattern

```swift
let context = LAContext()
var error: NSError?
if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
    context.evaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        localizedReason: "Unlock Atomic Nexus control plane"
    ) { success, _ in
        // On success, perform Secure Enclave signing or release capability lease
    }
}
```

Always provide a passcode fallback via `.deviceOwnerAuthentication` for resilience.

## 5. Integration with an-nexus

- The Secure Enclave key signs evidence envelopes whose payloads have already been JCS-canonicalized (`an_nexus.jcs`).
- Higher-layer dispatch calls `gate_sql` / `gate_sql_and_jcs` *before* any database or tool execution; the biometric/SE gate sits in front of capability release.
- `nexusBridge` (or equivalent native process) is responsible for presenting the LAContext UI and performing the SE operation; the TypeScript / Python layers only receive success/failure + signature.

## 6. Constraints & Entitlements

- `NSFaceIDUsageDescription` required in Info.plist.
- App Attest capability + environment entitlement if used.
- Background / pure-daemon contexts have restricted SE access; privileged operations should be driven from a user-interactive or properly entitled process.
- `.biometryCurrentSet` invalidates the key on biometric enrollment changes (desired for high-assurance identity).

## 7. Production Readiness Link

Closing this path on physical A16 hardware is one of the open founder gates listed in `docs/PRODUCTION_READINESS.md` (Xcode build, Instruments profiling, entitlement activation).

---

*This annex is normative for Apple-platform deployments of the Atomic Nexus Sovereign Substrate.*
