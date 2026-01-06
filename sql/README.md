# Database Setup Instructions

## Step 1: Run the SQL Script

1. **Open Supabase SQL Editor**
   - Go to: https://app.supabase.com/project/tymgrdjcamlbvhaexclh/sql/new
   - Or navigate: Your Project → SQL Editor → New Query

2. **Copy and Paste the SQL**
   - Open `create-tables.sql` file
   - Copy all the contents
   - Paste into the SQL Editor

3. **Run the Script**
   - Click "Run" or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
   - Wait for it to complete (should take a few seconds)

4. **Verify Tables Created**
   - Go to: Table Editor in the sidebar
   - You should see these tables:
     - `companies`
     - `contacts`
     - `deals`
     - `activities`
     - `notes`

## What Gets Created

### Tables:
- **companies** - Organizations/companies you're working with
- **contacts** - Individual people/contacts
- **deals** - Sales opportunities/deals
- **activities** - Tasks, calls, meetings, notes
- **notes** - Additional notes attached to deals/contacts/companies

### Features:
- ✅ UUID primary keys
- ✅ Automatic timestamps (created_at, updated_at)
- ✅ Foreign key relationships
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) enabled
- ✅ Auto-update triggers for updated_at

## Next Steps

After running the SQL:
1. Your MCP server can now query, insert, update, and delete records
2. You can start building your CRM frontend
3. Customize RLS policies based on your authentication needs

## Troubleshooting

If you get errors:
- Make sure you're running it in the SQL Editor (not a different tool)
- Check that you have the correct permissions
- Some errors might be about existing tables - that's okay, the script uses `IF NOT EXISTS`




