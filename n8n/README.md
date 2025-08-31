Gyomutime × n8n × Colab integration

Overview
- Pressing the buttons on grouping/timetable pages now POSTs to configurable n8n Webhook URLs.
- n8n should create a Colab-ready notebook on the fly (from a template), upload it to Google Drive, and return a `colab_url` which the frontend opens in a new tab.

Configure frontend
1) Set your Webhook URLs in `assets/js/n8n-config.js`:
   - `window.N8N_SECTIONING_WEBHOOK = 'https://<n8n-host>/webhook/gyomutime/sectioning'`
   - `window.N8N_TIMETABLE_WEBHOOK = 'https://<n8n-host>/webhook/gyomutime/timetable'`
   - Optionally set `window.N8N_AUTH_TOKEN` if your Webhook requires auth.

Recommended n8n workflow (Sectioning)
Create the following nodes and connections:

- Webhook (POST)
  - Path: `gyomutime/sectioning`
  - Respond: via separate node (do not respond immediately)
  - Binary data: accept `file` field

- Google Drive: Upload dataset
  - Credentials: Google Drive OAuth2
  - Operation: Upload
  - Use Binary Data: true
  - Binary Property: `file`
  - File Name: `{{$json["body"]["name"] || 'sectioning_data'}}`
  - Parent Folder: your folder ID (e.g., `Colab/Gyomutime`)
  - Output: store the uploaded `fileId` as `dataFileId` via an expression `{{$json["id"]}}`

- HTTP Request: Fetch notebook template
  - Method: GET
  - URL: Raw URL for `colab/templates/sectioning_template.ipynb` hosted (GitHub Raw / Netlify)

- Function: Fill template
  - Code:
    ```js
    const params = {
      name: $json.body.name,
      email: $json.body.email,
      notes: $json.body.notes,
      maxPerClass: Number($json.body.maxPerClass || 0),
      minSlots: Number($json.body.minSlots || 0),
      maxSlots: Number($json.body.maxSlots || 0),
    }
    const tpl = items[0].json; // from HTTP Request
    const fileId = $items("Google Drive: Upload dataset", 0, 0).json.id;
    const filled = tpl
      .replaceAll('<<<DATA_FILE_ID>>>', fileId)
      .replace('<<<PARAMS_JSON>>>', JSON.stringify(params))
    return [{ json: { content: filled } }]
    ```

- Move Binary Data: String → Binary
  - Set Property: `data`
  - Convert All Fields: false
  - Source Key: `content` (from previous node)

- Google Drive: Upload notebook
  - Operation: Upload
  - Use Binary Data: true
  - Binary Property: `data`
  - File Name: `Gyomutime_Sectioning_Auto.ipynb`
  - Mime Type: `application/x-ipynb+json`
  - Parent Folder: same as above

- Google Drive: Share file (optional, or set during upload)
  - Operation: Share
  - File ID: reference ID from previous upload
  - Sharing: Anyone with the link (reader)

- Respond to Webhook
  - JSON:
    ```json
    {
      "colab_url": "={{'https://colab.research.google.com/drive/' + $json["id"]}}",
      "notebook_file_id": "={{$json["id"]}}",
      "dataset_file_id": "={{$items('Google Drive: Upload dataset', 0, 0).json.id}}"
    }
    ```

Repeat a similar workflow for Timetable using `colab/templates/timetable_template.ipynb` and the fields posted by the timetable page. Replace placeholders `<<<DATA_FILE_ID>>>` and `<<<PARAMS_JSON>>>` accordingly.

Notes
- Colab does not support auto-executing notebooks from external links for security. The notebook will open ready; click Runtime → Run all.
- If you prefer GitHub Gist instead of Drive, you can swap the Google Drive steps with a GitHub “Create a Gist” node and return `https://colab.research.google.com/gist/<user>/<gist_id>`.

