
import { validateOpenAIKey } from './lib/validators.js';
import { loadConfig } from './lib/config.js';

async function main() {
    try {
        console.log('Loading config...');
        const config = await loadConfig();
        console.log('Config loaded.');

        if (config.api && config.api.openai && config.api.openai.apiKey) {
            console.log('OpenAI API key found.');
            const apiKey = config.api.openai.apiKey;
            console.log(`Key length: ${apiKey.length}`);

            console.log('Validating OpenAI key...');
            const result = await validateOpenAIKey(apiKey);
            console.log('Validation result:', result);
        } else {
            console.log('OpenAI API key NOT found in config.');
        }
    } catch (error) {
        console.error('Crash detected:', error);
    }
}

main();
