# Troubleshooting Guide

Common issues and solutions for Gemini Phone.

## Quick Diagnostics

Start here for most problems:

```bash
<gemini-phone doctor   # Automated health checks
<gemini-phone status   # Service status overview
<gemini-phone logs     # View recent logs
```

## Setup Issues

### "API key validation failed"

**Symptom:** Setup fails when validating ElevenLabs or OpenAI key.

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Key is incorrect | Double-check you copied the full key |
| No billing enabled | Add payment method to your account |
| Account suspended | Check account status on provider dashboard |
| Network issue | Check internet connectivity |

**For OpenAI specifically:**

- New accounts need billing enabled before API works
- Free tier credits expire after 3 months
- Check [platform.openai.com/account/billing](https://platform.openai.com/account/billing)

**For ElevenLabs:**

- Free tier has limited characters/month
- Check [elevenlabs.io/subscription](https://elevenlabs.io/subscription)

### "Can't connect to PBX"

**Symptom:** Setup can't connect to your FreePBX / SIP server.

**Solutions:**

1. Verify FreePBX FQDN or IP is correct (e.g., `192.168.1.50`)
2. Ensure extension is correctly configured in your PBX
3. Check firewall allows port 5060 (SIP) outbound
4. Try using port 5070 if 5060 is used by another service on the same machine

### "Docker not found" or "Docker not running"

**Symptom:** Prerequisite check fails for Docker.

**Solutions:**

**macOS:**

```bash
# Install Docker Desktop
brew install --cask docker
# Then launch Docker Desktop from Applications
```

**Linux (Debian/Ubuntu):**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

**Raspberry Pi:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker pi
# Reboot the Pi
```

## Connection Issues

### Calls don't connect at all

**Symptom:** Phone rings forever or immediately fails.

**Checklist:**

1. Is the extension registered with the PBX?

   ```bash
   gemini-phone status
   # Look for "SIP Registration: OK"
   ```

2. Is the SIP domain correct?

   ```bash
   gemini-phone config show
   # Check sip.domain matches your PBX FQDN/IP
   ```

3. Are credentials correct?
   - Log into FreePBX admin panel
   - Check extension auth ID and password match config

4. Is drachtio container running?

   ```bash
   docker ps | grep drachtio
   ```

### Extension not registering

**Symptom:** `<gemini-phone status` shows SIP registration failed.

**Solutions:**

1. Verify extension exists in FreePBX
2. Check auth ID matches (usually same as extension number)
3. Verify password is correct
4. Ensure extension settings allow registration from this host
5. Check if another device is using the same extension

### Calls connect but no audio

**Symptom:** Call connects, you can see it's answered, but there's silence.

**Most common cause:** Wrong `EXTERNAL_IP` setting.

**Fix:**

```bash
# Find your server's LAN IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Re-run setup to fix
<gemini-phone setup
# Enter correct IP when prompted for "External IP"
```

**Other causes:**

- RTP ports blocked by firewall (needs 30000-30100 UDP)
- NAT issues (server can't receive return audio)
- FreeSWITCH container unhealthy

### RTP Port Conflict

**Symptom:** Calls fail with "INCOMPATIBLE_DESTINATION" error. Logs show `AUDIO RTP REPORTS ERROR: [Bind Error! IP:port]`.

**Cause:** Standard PBX systems (like FreePBX/Asterisk) may use various RTP port ranges. If FreeSWITCH uses the same range, it can't bind.

**Fix:** Gemini Phone uses ports 30000-30100 by default. If you upgraded from an older version:

```bash
# Check current port config
grep "rtp-range" ~/.gemini-phone/docker-compose.yml

# If it shows 20000, update to 30000:
sed -i 's/--rtp-range-start 20000/--rtp-range-start 30000/' ~/.gemini-phone/docker-compose.yml
sed -i 's/--rtp-range-end 20100/--rtp-range-end 30100/' ~/.gemini-phone/docker-compose.yml

# Restart services
<gemini-phone stop
<gemini-phone start
```

## Runtime Issues

### "Sorry, something went wrong" on every call

**Symptom:** Calls connect, but Gemini always says there was an error.

**Causes:**

1. **API server unreachable:**

   ```bash
   <gemini-phone status
   # Check "Gemini API Server" status

   # For split deployments, verify connectivity:
   curl http://<api-server-ip>:3333/health
   ```

2. **Gemini Code CLI not working:**

   ```bash
   # On the API server machine:
   <gemini> --version
   <gemini> "Hello"  # Test basic functionality
   ```

3. **Session errors:**

   ```bash
   <gemini-phone logs voice-app | grep -i error
   ```

### Whisper transcription errors

**Symptom:** Gemini responds to wrong words or doesn't understand speech.

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| OpenAI billing exhausted | Add credits to OpenAI account |
| Audio quality poor | Check microphone, reduce background noise |
| Network latency | Audio chunks may be lost; check connection |

### ElevenLabs TTS errors

**Symptom:** Gemini's responses aren't spoken, or voice sounds wrong.

**Solutions:**

1. Check ElevenLabs character quota isn't exhausted
2. Verify voice ID is valid: `<gemini-phone device list`
3. Check API key still works

### Calls disconnect after a few seconds

**Symptom:** Call connects, maybe plays greeting, then drops.

**Causes:**

- FreeSWITCH timeout (check logs)
- SIP session timeout
- Network instability

```bash
# Check FreeSWITCH logs for clues
<gemini-phone logs freeswitch | tail -100
```

## Split Deployment Issues

### Pi can't reach API server

**Symptom:** Voice services start but calls fail with connection errors.

**Diagnostics:**

```bash
# On the Pi, test connectivity:
curl http://<api-server-ip>:3333/health

# Check configured API URL:
<gemini-phone config show | grep geminiApiUrl
```

**Solutions:**

1. Verify API server IP is correct in Pi's config
2. Ensure API server is running: `<gemini-phone api-server`
3. Check firewall allows port 3333
4. Verify both machines are on same network (or have routing)

### API server won't start

**Symptom:** `<gemini-phone api-server` fails immediately.

**Solutions:**

1. Check port 3333 isn't already in use:

   ```bash
   lsof -i :3333
   ```

2. Verify Gemini Code CLI works:

   ```bash
   <gemini-phone> --version
   ```

3. Check for Node.js errors in output

## Getting Logs

### Voice App Logs

```bash
<gemini-phone logs voice-app
# or
docker compose logs -f voice-app
```

### SIP Server Logs

```bash
<gemini-phone logs drachtio
# or
docker compose logs -f drachtio
```

### Media Server Logs

```bash
<gemini-phone logs freeswitch
# or
docker compose logs -f freeswitch
```

### API Server Logs

```bash
# If running in foreground, check terminal output
# If running via start command, check:
cat ~/.gemini-phone/api-server.log
```

## Still Stuck?

1. **Check the video tutorial:** [youtu.be/cT22fTzotYc](https://youtu.be/cT22fTzotYc) covers common setup issues
2. **Run full diagnostics:** `<gemini-phone doctor`
3. **Open an issue:** [github.com/jayis1/networkschucks-phone-but-for-gemini/issues](https://github.com/jayis1/networkschucks-phone-but-for-gemini/issues)

When opening an issue, include:

- Output of `<gemini-phone doctor`
- Output of `<gemini-phone status`
- Relevant log snippets (redact any API keys!)
- Your deployment type (All-in-one or Split)
- Platform (macOS, Linux, Raspberry Pi)
