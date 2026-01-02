# Seed Kit Templates to Staging

This script seeds default kit templates to the staging Firestore database.

## Prerequisites

1. **Authentication**: You need access to the staging Firebase project
   - Either use Application Default Credentials (ADC) - recommended if running from GCP
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file

2. **Environment Variables**:
   - `FIREBASE_PROJECT_ID` - Firebase project ID (default: `everredi-dev`)
   - `FIREBASE_DATABASE_ID` - Firestore database ID (default: `staging`)

## Usage

### Basic Usage (Uses Defaults)

```bash
cd api
npm run seed:staging
```

This will:
- Connect to `everredi-dev` project
- Use the `staging` Firestore database
- Create templates if they don't exist
- Skip existing templates (won't overwrite)

### Force Update Existing Templates

```bash
npm run seed:staging -- --force
```

This will update existing templates if they already exist.

### Custom Project/Database

```bash
FIREBASE_PROJECT_ID=your-project-id \
FIREBASE_DATABASE_ID=your-database-id \
npm run seed:staging
```

### Using Service Account Key

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json \
npm run seed:staging
```

## What Gets Seeded

The script seeds the following default templates to `publicKitTemplates`:

1. **Basic First Aid Kit** - General purpose, 4 people, beginner
2. **Hiking/Outdoor Kit** - Outdoor adventures, 6 people, intermediate
3. **Car Emergency Kit** - Vehicle emergencies, 5 people, beginner
4. **Home Emergency Kit** - Home use, 8 people, beginner
5. **Sports First Aid Kit** - Sports activities, 10 people, intermediate
6. **Workplace First Aid Kit** - Office/workplace, 20 people, beginner
7. **Travel First Aid Kit** - Travel use, 2 people, beginner
8. **Pet First Aid Kit** - Pet emergencies, 1 pet, beginner

Each template includes:
- Name and description
- Purpose, group size, environment, skill level
- Default people count and options
- Kit items with quantities and notes

## Output

The script will show:
- Which templates were created
- Which templates were updated (if using `--force`)
- Which templates were skipped (already exist)
- Any errors that occurred

## Troubleshooting

### "Permission denied" or Authentication Errors

- Ensure you have the correct Firebase project permissions
- Check that `GOOGLE_APPLICATION_CREDENTIALS` points to a valid service account key
- Or ensure Application Default Credentials are configured correctly

### "Database not found"

- Verify the `FIREBASE_DATABASE_ID` is correct
- Check that the database exists in the Firebase project

### Templates Not Appearing

- Check Firestore console to verify templates were created
- Look for errors in the script output
- Verify the `publicKitTemplates` collection exists

## Notes

- The script is idempotent - safe to run multiple times
- Existing templates are skipped unless `--force` is used
- Templates are created in the `publicKitTemplates` collection
- The script also ensures a system user exists for template ownership

