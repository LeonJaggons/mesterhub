# Marketplace Happy Path QA

Run this against local Firebase emulators or a disposable Firebase project before deploy.

## Customer Demand

1. Seed or activate at least one pro profile with `status: "active"` and public fields under `pros/{uid}`.
2. Search from the homepage for one of that pro's services and confirm the pro appears in `/instant-results`.
3. Open the profile, use the mobile and desktop request CTA, and submit a request with browser location allowed.
4. Submit a second request with browser location denied and confirm the selected district is still saved.

## Pro Response

1. Sign in as the pro and open `/pro/jobs`.
2. Confirm the pending request appears.
3. Send a quote and verify the request status changes to `quoted`.
4. Decline another pending request and verify it cannot be quoted afterward.

## Customer Acceptance And Messaging

1. Sign in as the customer and open `/requests/{requestId}`.
2. Accept the quote with a message, phone, address, and preferred start.
3. Confirm `/messages/{requestId}` opens and contains the acceptance message.
4. Send a follow-up message from both customer and pro accounts.
5. From the pro side, propose an appointment and confirm the customer can approve it.

## Rules Smoke Checks

1. A signed-out user can read only active pro public profiles.
2. A signed-out user cannot read requests, conversations, messages, or private pro subdocuments.
3. A customer cannot update quote/status fields directly from the client SDK.
4. A pro cannot read or update another pro's private subdocuments.
