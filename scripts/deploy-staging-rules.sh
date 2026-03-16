#!/bin/bash
# Deploy Firestore rules and indexes to the staging database.
# Requires GOOGLE_APPLICATION_CREDENTIALS or gcloud auth already set up.
# Usage: ./scripts/deploy-staging-rules.sh

set -euo pipefail

PROJECT="modo-mapa-app"
DATABASE="staging"

# Get access token from gcloud (works in CI with service account)
ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: Could not get access token. Run 'gcloud auth login' or set GOOGLE_APPLICATION_CREDENTIALS."
  exit 1
fi

echo "==> Deploying Firestore rules to $DATABASE database..."

# 1. Create ruleset from firestore.rules
RULES_CONTENT=$(cat firestore.rules | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.stringify(d)))')

RULESET_RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT/rulesets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"source\":{\"files\":[{\"content\":$RULES_CONTENT,\"name\":\"firestore.rules\"}]}}")

RULESET_NAME=$(echo "$RULESET_RESPONSE" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const r=JSON.parse(d);if(r.error){console.error("Error:",r.error.message);process.exit(1)}console.log(r.name)})')

echo "    Ruleset created: $RULESET_NAME"

# 2. Apply ruleset to staging database
curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT/releases/cloud.firestore%2F$DATABASE" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"release\":{\"name\":\"projects/$PROJECT/releases/cloud.firestore/$DATABASE\",\"rulesetName\":\"$RULESET_NAME\"}}" > /dev/null

echo "    Rules deployed to $DATABASE"

# 3. Deploy indexes (check for new collections in firestore.indexes.json)
echo "==> Deploying Firestore indexes to $DATABASE database..."

# Read indexes from firestore.indexes.json and create any missing ones
node -e '
const fs = require("fs");
const https = require("https");
const indexes = JSON.parse(fs.readFileSync("firestore.indexes.json", "utf8")).indexes;
const token = process.argv[1];
const project = process.argv[2];
const database = process.argv[3];

async function createIndex(idx) {
  const collection = idx.collectionGroup;
  const body = JSON.stringify({ queryScope: idx.queryScope, fields: idx.fields });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: "firestore.googleapis.com",
      path: `/v1/projects/${project}/databases/${database}/collectionGroups/${collection}/indexes`,
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", (d) => data += d);
      res.on("end", () => {
        const r = JSON.parse(data);
        if (r.error && r.error.code === 409) {
          console.log(`    Index ${collection} already exists`);
        } else if (r.error) {
          console.log(`    Index ${collection} error: ${r.error.message}`);
        } else {
          console.log(`    Index ${collection} creating...`);
        }
        resolve();
      });
    });
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const idx of indexes) {
    await createIndex(idx);
  }
  console.log("    Indexes deployment complete");
})();
' "$ACCESS_TOKEN" "$PROJECT" "$DATABASE"

echo "==> Staging deploy complete"
