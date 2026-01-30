/**
 * Voicemail Service
 * INTERFACE: Read-only access to Asterisk voicemail files
 *
 * Scans standard Asterisk voicemail directory structure:
 * /var/spool/asterisk/voicemail/default/{extension}/INBOX/
 *
 * Files:
 * - msg0000.txt: Metadata (Caller ID, timestamp, duration)
 * - msg0000.wav: Audio file
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const VOICEMAIL_BASE = process.env.VOICEMAIL_DIR || '/var/spool/asterisk/voicemail/default';

class VoicemailService {
    /**
     * List voicemails for an extension
     * @param {string} extension
     * @returns {Promise<Array>} List of messages
     */
    async listVoicemails(extension) {
        const inboxPath = path.join(VOICEMAIL_BASE, extension, 'INBOX');

        try {
            if (!fs.existsSync(inboxPath)) {
                return [];
            }

            const files = await readdir(inboxPath);
            const textFiles = files.filter(f => f.endsWith('.txt')).sort();

            const messages = [];

            for (const file of textFiles) {
                const id = file.replace('.txt', '');
                const txtPath = path.join(inboxPath, file);
                const wavPath = path.join(inboxPath, id + '.wav');

                // Read metadata
                const metadata = await this.parseMetadata(txtPath);

                // Add file paths for playback/transcription
                metadata.id = id;
                metadata.wavPath = fs.existsSync(wavPath) ? wavPath : null;

                messages.push(metadata);
            }

            return messages;

        } catch (error) {
            console.error(`[VOICEMAIL] Error listing for ${extension}:`, error.message);
            return [];
        }
    }

    /**
     * Parse Asterisk voicemail metadata file
     * @param {string} filePath 
     */
    async parseMetadata(filePath) {
        try {
            const content = await readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const data = {};

            for (const line of lines) {
                if (line.includes('=')) {
                    const [key, value] = line.split('=');
                    data[key.trim()] = value ? value.trim() : '';
                }
            }

            // Format timestamp (Asterisk uses origtime=UnixTimestamp)
            const timestamp = data.origtime ? new Date(parseInt(data.origtime) * 1000) : new Date();

            return {
                callerId: data.callerid || 'Unknown',
                timestamp: timestamp.toISOString(),
                duration: data.duration || '0'
            };

        } catch (error) {
            return { callerId: 'Unknown', timestamp: new Date().toISOString() };
        }
    }

    /**
     * Get latest voicemail
     */
    async getLatestVoicemail(extension) {
        const messages = await this.listVoicemails(extension);
        return messages.length > 0 ? messages[messages.length - 1] : null;
    }
}

module.exports = new VoicemailService();
