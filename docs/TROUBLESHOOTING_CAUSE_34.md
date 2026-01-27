# SIP Error: 503 Service Unavailable (Cause 34)

If you see `Sip non-success response: 503` in your logs with `Reason: Q.850;cause=34`, it means **"No circuit/channel available"**.

In the context of FreePBX, this almost always means your PBX does not have a working path to the phone number you are trying to call.

## The Smoking Gun

If you go to **Reports -> Asterisk Info -> Registries** in FreePBX and see **"No objects found"** or your Trunk is not listed as `Registered`, this is why the call is failing.

---

## How to Fix It

### 1. Check your SIP Trunk

You need a "phone line" (SIP Trunk) from a provider like Twilio, VoIP.ms, or Telnyx.

* Go to **Connectivity -> Trunks**.
* Ensure your trunk is configured and active.
* Check **Reports -> Asterisk Info -> Registries** to confirm it says `Registered`.

### 2. Check your Outbound Routes

Even with a trunk, FreePBX needs to know *which* calls to send to it.

* Go to **Connectivity -> Outbound Routes**.
* Create a new route (e.g., "MainOut").
* In **Trunk Sequence for Matched Routes**, select your active Trunk.
* In **Dial Patterns**, add a rule with `.` (a single dot) in the **match pattern** field. This matches all dialed numbers.

### 3. Verification

Try placing the call again from Gemini Phone (or the Mission Control dashboard).

If you still get a 503:

* Check the **Asterisk Logfiles** (**Reports -> Asterisk Logfiles**) for more specific errors during the call attempt.
* Ensure your Trunk provider doesn't require a specific caller ID prefix (like `+1` for US numbers).

---

## Local Testing (No Trunk needed)

If you don't have a SIP Trunk yet, you can still test by calling **another extension** on the same FreePBX:

1. Download a SIP app (like **Zoiper** or **Linphone**) on your smartphone/PC.
2. Register it as extension `9001` (or any other extension you created).
3. Have Gemini Phone call `9001` instead of a mobile number.
