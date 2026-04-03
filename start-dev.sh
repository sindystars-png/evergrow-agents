#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd /Users/emilypro/Documents/Evergrow\ Fin/evergrow-agents
exec /usr/local/bin/node node_modules/.bin/next dev --webpack
