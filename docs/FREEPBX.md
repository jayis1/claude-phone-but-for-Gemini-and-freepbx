# FreePBX / Asterisk Integration Guide

Gemini Phone is fully compatible with FreePBX, Asterisk, and other standard SIP servers. While 3CX was the initial target, the underlying SIP engine (Drachtio) works with any SIP 2.0 compliant registrar.

## Quick Setup for FreePBX

### 1. Create a PJSIP Extension

1. Log in to FreePBX Administration.
2. Go to **Applications** > **Extensions**.
3. Click **Add Extension** > **Add New PJSIP Extension**.
4. **User Extension**: `8000` (or your preferred number).
5. **Display Name**: `Gemini AI`.
6. **Secret**: Generate a strong password (e.g., `SuperSecret123`).
7. Click **Submit** and **Apply Config**.

### 2. Configure Docker Environment

Update your `.env` file or `docker-compose.yml` with the FreePBX details.

```bash
# SIP Configuration for FreePBX
SIP_DOMAIN=192.168.1.50      # IP address of FreePBX
SIP_REGISTRAR=192.168.1.50   # IP address of FreePBX
SIP_EXTENSION=8000           # The extension number you created
SIP_AUTH_ID=8000             # For FreePBX, Auth ID is usually the same as Extension
SIP_AUTH_PASSWORD=SuperSecret123
```

> **Note**: For FreePBX/Asterisk, `SIP_AUTH_ID` is typically the same as the `SIP_EXTENSION`. In 3CX, they are often different.

### 3. Network Configuration

Ensure your Docker container can reach the FreePBX server.

- If FreePBX is on the same LAN: The default `host` networking or bridged IP usually works.
- **Firewall**: Ensure port **5060 (UDP/TCP)** and RTP ports **10000-20000** (or your configured range) are open on the FreePBX server.

## Troubleshooting

### "Registration Failed"

- Check that **PJSIP** is listening on port 5060. older FreePBX versions might use chan_sip on 5060 and PJSIP on 5061.
- Check fail2ban on FreePBX (`/var/log/fail2ban.log`) to ensure the Gemini Phone IP hasn't been banned.

### No Audio

- This is almost always NAT.
- Ensure `EXTERNAL_IP` in your `.env` matches the actual LAN IP of the machine running Gemini Phone.
- In FreePBX Extension settings, set **Direct Media**: `No` (forces audio through Asterisk, often fixes NAT issues).
