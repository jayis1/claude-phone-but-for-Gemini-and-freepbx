#!/bin/bash

# Configuration
API_URL="http://localhost:3000"  # Voice App 1 (Controller)
FROM_DEVICE="9000"               # Morpheus (Stack 1)
TO_EXTENSION="9010"              # Trinity (Stack 2)

echo "🤖 Initiating AI-to-AI Call Test..."
echo "📞 Caller: Morpheus (Ext $FROM_DEVICE)"
echo "📞 Callee: Trinity  (Ext $TO_EXTENSION)"
echo ""

# The context is what Morpheus "knows" before calling.
# The message is what Morpheus "says" to start the conversation.

curl -X POST "$API_URL/api/outbound-call" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'"$TO_EXTENSION"'",
    "mode": "conversation",
    "device": "'"$FROM_DEVICE"'",
    "message": "Hello Trinity. This is Morpheus. I need to test our secure line. Are we operational?",
    "context": "You are Morpheus. You are calling Trinity to verify the secure communication channel between your neural networks. You should be professional but hint at the Matrix.",
    "timeoutSeconds": 60
  '

echo ""
echo "✅ Request sent! Check Mission Control for status."
