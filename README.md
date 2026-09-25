# audrey-care-ops

## SMS notifications (send.lk)

Automatically texts the customer when an order reaches **Picked Up by Delivery**, and adds a manual
**Send SMS** button in the order drawer. The send.lk API key never touches the browser — it lives only
in a Supabase Edge Function.

### One-time setup

1. Install the Supabase CLI and log in, then link this project:
   ```
   supabase login
   supabase link --project-ref mntnobzwbvqpvmaxqcuc
   ```
2. Set the secrets the function needs (your send.lk API token + sender ID, plus a password you invent
   yourself for `SMS_APP_SECRET` — any long random string):
   ```
   supabase secrets set SEND_LK_API_TOKEN=your_send_lk_api_token
   supabase secrets set SEND_LK_SENDER_ID=your_send_lk_sender_id
   supabase secrets set SMS_APP_SECRET=some-long-random-string
   ```
3. Deploy the function:
   ```
   supabase functions deploy send-sms --no-verify-jwt
   ```
   (`--no-verify-jwt` is required — the app calls this function with the public anon key, not a
   per-user login token, since the app itself doesn't have real user accounts.)
4. Open `audrey-care-ops-v9.html`, find `SMS_APP_SECRET` near the top of the `<script>` block, and set
   it to the **exact same string** you used in step 2. SMS sending stays off until this is changed from
   the placeholder value.

### If a test message doesn't send

Open the order drawer, click **Send SMS**, and check the toast message — it echoes back whatever
send.lk's API returned. The request format lives entirely in
`supabase/functions/send-sms/index.ts`, so if send.lk expects different field names than what's there
(`recipient` / `sender_id` / `message` / `api_token`), that's the only file to change; redeploy with the
same `supabase functions deploy send-sms --no-verify-jwt` command afterward.

### Security note

`SMS_APP_SECRET` stops casual requests to the function URL, but it still ships inside the page's
JavaScript (same as the Supabase anon key already does) — anyone who reads the page source can find it.
This is a limitation of the app having no real per-user login backend, not something a stronger secret
would fix. If SMS usage ever looks abnormal on your send.lk dashboard, rotate `SEND_LK_API_TOKEN` and
`SMS_APP_SECRET` and redeploy.
