use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{Map, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::billing::{self, WebhookEffect};
use crate::error::AppError;
use crate::time::{add_days, iso, iso_opt, parse_rfc3339, start_of_utc_day};

const FREE_KITS: i64 = 5;
const FREE_ITEMS: i64 = 100;
const FREE_LOCATIONS: i64 = 2;

#[derive(Debug, sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    email: String,
    display_name: Option<String>,
    avatar_url: Option<String>,
    subscription_tier: String,
    subscription_status: String,
    subscription_expires_at: Option<DateTime<Utc>>,
    is_admin: bool,
    onboarding_completed: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct WorkspaceRow {
    id: Uuid,
    name: String,
    r#type: String,
    owner_user_id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct LocationRow {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    description: Option<String>,
    location_type: String,
    is_primary: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct KitRow {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    location_id: Option<Uuid>,
    status: String,
    template_id: Option<Uuid>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
struct ItemRow {
    id: Uuid,
    workspace_id: Uuid,
    kit_id: Option<Uuid>,
    supply_id: Option<Uuid>,
    freeform_name: Option<String>,
    supply_name: String,
    supply_category_id: Option<Uuid>,
    location_id: Option<Uuid>,
    required_quantity: Option<i32>,
    actual_quantity: Option<i32>,
    status: String,
    expiration_date: Option<DateTime<Utc>>,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserJson {
    id: Uuid,
    email: String,
    display_name: Option<String>,
    avatar_url: Option<String>,
    subscription_tier: String,
    subscription_status: String,
    subscription_expires_at: Option<String>,
    is_admin: bool,
    onboarding_completed: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceJson {
    id: Uuid,
    name: String,
    r#type: String,
    owner_user_id: Uuid,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocationJson {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    description: Option<String>,
    location_type: String,
    is_primary: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KitJson {
    id: Uuid,
    workspace_id: Uuid,
    name: String,
    location_id: Option<Uuid>,
    status: String,
    template_id: Option<Uuid>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ItemJson {
    id: Uuid,
    workspace_id: Uuid,
    kit_id: Option<Uuid>,
    supply_id: Option<Uuid>,
    freeform_name: Option<String>,
    supply_name: String,
    supply_category_id: Option<Uuid>,
    location_id: Option<Uuid>,
    required_quantity: Option<i32>,
    actual_quantity: Option<i32>,
    status: String,
    expiration_date: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TemplateItemJson {
    id: Uuid,
    supply_id: Option<Uuid>,
    freeform_name: Option<String>,
    supply_name: String,
    required_quantity: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TemplateJson {
    id: Uuid,
    name: String,
    description: Option<String>,
    category: Option<String>,
    is_public: bool,
    items: Vec<TemplateItemJson>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CategoryJson {
    id: Uuid,
    name: String,
    description: Option<String>,
    icon_name: Option<String>,
    sort_order: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SupplyJson {
    id: Uuid,
    category_id: Option<Uuid>,
    name: String,
    description: Option<String>,
    default_unit: Option<String>,
    typical_shelf_life_days: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NotificationJson {
    id: Uuid,
    user_id: Uuid,
    workspace_id: Option<Uuid>,
    r#type: String,
    title: String,
    message: String,
    data: Option<Value>,
    is_read: bool,
    created_at: String,
}

fn user_json(row: UserRow) -> UserJson {
    UserJson {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        subscription_tier: row.subscription_tier,
        subscription_status: row.subscription_status,
        subscription_expires_at: iso_opt(row.subscription_expires_at),
        is_admin: row.is_admin,
        onboarding_completed: row.onboarding_completed,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
    }
}

fn workspace_json(row: WorkspaceRow) -> WorkspaceJson {
    WorkspaceJson {
        id: row.id,
        name: row.name,
        r#type: row.r#type,
        owner_user_id: row.owner_user_id,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
    }
}

fn location_json(row: LocationRow) -> LocationJson {
    LocationJson {
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        description: row.description,
        location_type: row.location_type,
        is_primary: row.is_primary,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
    }
}

fn kit_json(row: KitRow) -> KitJson {
    KitJson {
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        location_id: row.location_id,
        status: row.status,
        template_id: row.template_id,
        notes: row.notes,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
        deleted_at: iso_opt(row.deleted_at),
    }
}

fn item_json(row: ItemRow) -> ItemJson {
    ItemJson {
        id: row.id,
        workspace_id: row.workspace_id,
        kit_id: row.kit_id,
        supply_id: row.supply_id,
        freeform_name: row.freeform_name,
        supply_name: row.supply_name,
        supply_category_id: row.supply_category_id,
        location_id: row.location_id,
        required_quantity: row.required_quantity,
        actual_quantity: row.actual_quantity,
        status: row.status,
        expiration_date: iso_opt(row.expiration_date),
        notes: row.notes,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
    }
}

const USER_COLUMNS: &str = "id, email, display_name, avatar_url, subscription_tier, subscription_status, subscription_expires_at, is_admin, onboarding_completed, created_at, updated_at";
const KIT_COLUMNS: &str = "id, workspace_id, name, location_id, status::text AS status, template_id, notes, created_at, updated_at, deleted_at";
const ITEM_COLUMNS: &str = "id, workspace_id, kit_id, supply_id, freeform_name, supply_name, supply_category_id, location_id, required_quantity, actual_quantity, status::text AS status, expiration_date, notes, created_at, updated_at";

pub async fn upsert_user(
    pool: &PgPool,
    id: Uuid,
    email: &str,
    body: &Value,
) -> Result<UserJson, AppError> {
    let display_name = optional_trimmed(body, "displayName", 255)?;
    let avatar_url = optional_string(body, "avatarUrl")?;
    let onboarding = optional_bool(body, "onboardingCompleted")?;
    let existing =
        sqlx::query_as::<_, UserRow>(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1"))
            .bind(id)
            .fetch_optional(pool)
            .await?;

    let row = if let Some(existing) = existing {
        sqlx::query_as::<_, UserRow>(&format!(
            "UPDATE users SET email = $2, display_name = $3, avatar_url = $4, onboarding_completed = $5, last_login_at = NOW()
             WHERE id = $1 RETURNING {USER_COLUMNS}"
        ))
        .bind(id)
        .bind(email)
        .bind(display_name.unwrap_or(existing.display_name))
        .bind(match avatar_url {
            None => existing.avatar_url,
            Some(value) => value,
        })
        .bind(onboarding.unwrap_or(existing.onboarding_completed))
        .fetch_one(pool)
        .await?
    } else {
        let local = email.split('@').next().filter(|part| !part.is_empty());
        let name = match display_name {
            Some(Some(name)) => Some(name),
            Some(None) => None,
            None => Some(local.unwrap_or("My").to_string()),
        };
        sqlx::query_as::<_, UserRow>(&format!(
            "INSERT INTO users (id, email, display_name, avatar_url, onboarding_completed, last_login_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING {USER_COLUMNS}"
        ))
        .bind(id)
        .bind(email)
        .bind(name)
        .bind(avatar_url.flatten())
        .bind(onboarding.unwrap_or(false))
        .fetch_one(pool)
        .await?
    };
    Ok(user_json(row))
}

pub async fn update_me(pool: &PgPool, id: Uuid, body: &Value) -> Result<UserJson, AppError> {
    let existing = get_user(pool, id).await?;
    let display_name = optional_trimmed(body, "displayName", 255)?;
    let avatar_url = optional_string(body, "avatarUrl")?;
    let onboarding = optional_bool(body, "onboardingCompleted")?;
    let row = sqlx::query_as::<_, UserRow>(&format!(
        "UPDATE users SET display_name = $2, avatar_url = $3, onboarding_completed = $4
         WHERE id = $1 RETURNING {USER_COLUMNS}"
    ))
    .bind(id)
    .bind(display_name.unwrap_or(existing.display_name))
    .bind(match avatar_url {
        None => existing.avatar_url,
        Some(value) => value,
    })
    .bind(onboarding.unwrap_or(existing.onboarding_completed))
    .fetch_one(pool)
    .await?;
    Ok(user_json(row))
}

pub async fn get_user_json(pool: &PgPool, id: Uuid) -> Result<UserJson, AppError> {
    Ok(user_json(get_user(pool, id).await?))
}

async fn get_user(pool: &PgPool, id: Uuid) -> Result<UserRow, AppError> {
    sqlx::query_as::<_, UserRow>(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("User not found"))
}

pub async fn ensure_personal_workspace(
    pool: &PgPool,
    user_id: Uuid,
    email: &str,
) -> Result<WorkspaceJson, AppError> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT id FROM users WHERE id = $1 FOR UPDATE")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    let existing = sqlx::query_as::<_, WorkspaceRow>(
        "SELECT w.id, w.name, w.type::text AS type, w.owner_user_id, w.created_at, w.updated_at
         FROM workspace_members m
         JOIN workspaces w ON w.id = m.workspace_id
         WHERE m.user_id = $1 AND w.type = 'personal'
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = existing {
        tx.commit().await?;
        return Ok(workspace_json(row));
    }
    let local = email
        .split('@')
        .next()
        .filter(|part| !part.is_empty())
        .unwrap_or("My");
    let name = format!("{local}'s workspace");
    let row = sqlx::query_as::<_, WorkspaceRow>(
        "INSERT INTO workspaces (type, name, owner_user_id)
         VALUES ('personal', $1, $2)
         RETURNING id, name, type::text AS type, owner_user_id, created_at, updated_at",
    )
    .bind(&name)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
    )
    .bind(row.id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(workspace_json(row))
}

pub async fn list_workspaces(pool: &PgPool, user_id: Uuid) -> Result<Vec<WorkspaceJson>, AppError> {
    let rows = sqlx::query_as::<_, WorkspaceRow>(
        "SELECT w.id, w.name, w.type::text AS type, w.owner_user_id, w.created_at, w.updated_at
         FROM workspace_members m
         JOIN workspaces w ON w.id = m.workspace_id
         WHERE m.user_id = $1
         ORDER BY w.created_at",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(workspace_json).collect())
}

async fn require_member(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<String, AppError> {
    let role: Option<(String,)> = sqlx::query_as(
        "SELECT role::text FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    role.map(|row| row.0)
        .ok_or_else(|| AppError::forbidden("Not a workspace member"))
}

async fn is_premium(pool: &PgPool, user_id: Uuid) -> Result<bool, AppError> {
    let row = get_user(pool, user_id).await?;
    if row.subscription_tier != "premium" || row.subscription_status != "active" {
        return Ok(false);
    }
    if let Some(expires) = row.subscription_expires_at {
        if expires < Utc::now() {
            return Ok(false);
        }
    }
    Ok(true)
}

async fn assert_limit(
    pool: &PgPool,
    user_id: Uuid,
    count_sql: &str,
    workspace_id: Uuid,
    limit: i64,
    message: String,
) -> Result<(), AppError> {
    if is_premium(pool, user_id).await? {
        return Ok(());
    }
    let (count,): (i64,) = sqlx::query_as(count_sql)
        .bind(workspace_id)
        .fetch_one(pool)
        .await?;
    if count >= limit {
        return Err(AppError::forbidden(message));
    }
    Ok(())
}

pub async fn list_locations(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<LocationJson>, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    let rows = sqlx::query_as::<_, LocationRow>(
        "SELECT id, workspace_id, name, description, location_type, is_primary, created_at, updated_at
         FROM locations WHERE workspace_id = $1 ORDER BY created_at",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(location_json).collect())
}

pub async fn create_location(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<LocationJson, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    assert_limit(
        pool,
        user_id,
        "SELECT count(*)::bigint FROM locations WHERE workspace_id = $1",
        workspace_id,
        FREE_LOCATIONS,
        format!("Free plan allows {FREE_LOCATIONS} locations"),
    )
    .await?;
    let name = required_trimmed(body, "name", 255)?;
    let description = optional_string(body, "description")?.flatten();
    let location_type = optional_enum(
        body,
        "locationType",
        &["home", "office", "vehicle", "backpack", "general"],
    )?
    .unwrap_or_else(|| "general".into());
    let is_primary = optional_bool(body, "isPrimary")?.unwrap_or(false);
    let row = sqlx::query_as::<_, LocationRow>(
        "INSERT INTO locations (workspace_id, name, description, location_type, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, workspace_id, name, description, location_type, is_primary, created_at, updated_at",
    )
    .bind(workspace_id)
    .bind(name)
    .bind(description)
    .bind(location_type)
    .bind(is_primary)
    .fetch_one(pool)
    .await?;
    Ok(location_json(row))
}

pub async fn update_location(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<LocationJson, AppError> {
    let existing = sqlx::query_as::<_, LocationRow>(
        "SELECT id, workspace_id, name, description, location_type, is_primary, created_at, updated_at
         FROM locations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("Location not found"))?;
    require_member(pool, existing.workspace_id, user_id).await?;
    let name = optional_trimmed(body, "name", 255)?.unwrap_or(Some(existing.name));
    let description = match optional_string(body, "description")? {
        None => existing.description,
        Some(value) => value,
    };
    let location_type = optional_enum(
        body,
        "locationType",
        &["home", "office", "vehicle", "backpack", "general"],
    )?
    .unwrap_or(existing.location_type);
    let is_primary = optional_bool(body, "isPrimary")?.unwrap_or(existing.is_primary);
    let row = sqlx::query_as::<_, LocationRow>(
        "UPDATE locations SET name = $2, description = $3, location_type = $4, is_primary = $5
         WHERE id = $1
         RETURNING id, workspace_id, name, description, location_type, is_primary, created_at, updated_at",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(location_type)
    .bind(is_primary)
    .fetch_one(pool)
    .await?;
    Ok(location_json(row))
}

pub async fn delete_location(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let existing = sqlx::query_as::<_, LocationRow>(
        "SELECT id, workspace_id, name, description, location_type, is_primary, created_at, updated_at
         FROM locations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("Location not found"))?;
    let role = require_member(pool, existing.workspace_id, user_id).await?;
    if role == "member" {
        return Err(AppError::forbidden("Insufficient workspace role"));
    }
    sqlx::query("DELETE FROM locations WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_templates(pool: &PgPool) -> Result<Vec<TemplateJson>, AppError> {
    let templates = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, bool)>(
        "SELECT id, name, description, category, is_public FROM kit_templates WHERE is_public = true ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    let mut out = Vec::new();
    for (id, name, description, category, is_public) in templates {
        let items = sqlx::query_as::<_, (Uuid, Option<Uuid>, Option<String>, String, i32)>(
            "SELECT id, supply_id, freeform_name, supply_name, required_quantity
             FROM kit_template_items WHERE template_id = $1 ORDER BY supply_name",
        )
        .bind(id)
        .fetch_all(pool)
        .await?;
        out.push(TemplateJson {
            id,
            name,
            description,
            category,
            is_public,
            items: items
                .into_iter()
                .map(
                    |(id, supply_id, freeform_name, supply_name, required_quantity)| {
                        TemplateItemJson {
                            id,
                            supply_id,
                            freeform_name,
                            supply_name,
                            required_quantity,
                        }
                    },
                )
                .collect(),
        });
    }
    Ok(out)
}

pub async fn list_kits(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<KitJson>, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    let rows = sqlx::query_as::<_, KitRow>(&format!(
        "SELECT {KIT_COLUMNS} FROM kits WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY created_at"
    ))
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(kit_json).collect())
}

pub async fn get_kit(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<KitJson, AppError> {
    let row = load_kit(pool, id).await?;
    require_member(pool, row.workspace_id, user_id).await?;
    Ok(kit_json(row))
}

async fn load_kit(pool: &PgPool, id: Uuid) -> Result<KitRow, AppError> {
    let row = sqlx::query_as::<_, KitRow>(&format!("SELECT {KIT_COLUMNS} FROM kits WHERE id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("Kit not found"))?;
    if row.deleted_at.is_some() {
        return Err(AppError::not_found("Kit not found"));
    }
    Ok(row)
}

pub async fn create_kit(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<KitJson, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    assert_limit(
        pool,
        user_id,
        "SELECT count(*)::bigint FROM kits WHERE workspace_id = $1 AND deleted_at IS NULL",
        workspace_id,
        FREE_KITS,
        format!("Free plan allows {FREE_KITS} kits"),
    )
    .await?;
    let name = required_trimmed(body, "name", 255)?;
    let location_id = optional_uuid(body, "locationId")?;
    let notes = optional_string(body, "notes")?;
    if let Some(Some(notes)) = &notes {
        if notes.len() > 5000 {
            return Err(AppError::bad_request("notes is too long"));
        }
    }
    let status = optional_enum(
        body,
        "status",
        &["active", "archived", "incomplete", "complete"],
    )?
    .unwrap_or_else(|| "active".into());
    let template_id = optional_uuid(body, "templateId")?;
    let row = sqlx::query_as::<_, KitRow>(&format!(
        "INSERT INTO kits (workspace_id, name, location_id, notes, status, template_id)
         VALUES ($1, $2, $3, $4, $5::kit_status, $6)
         RETURNING {KIT_COLUMNS}"
    ))
    .bind(workspace_id)
    .bind(name)
    .bind(location_id.flatten())
    .bind(notes.flatten())
    .bind(status)
    .bind(template_id.flatten())
    .fetch_one(pool)
    .await?;
    Ok(kit_json(row))
}

pub async fn update_kit(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<KitJson, AppError> {
    let existing = load_kit(pool, id).await?;
    require_member(pool, existing.workspace_id, user_id).await?;
    let name = optional_trimmed(body, "name", 255)?.unwrap_or(Some(existing.name));
    let location_id = match optional_uuid(body, "locationId")? {
        None => existing.location_id,
        Some(value) => value,
    };
    let notes = match optional_string(body, "notes")? {
        None => existing.notes,
        Some(value) => value,
    };
    if let Some(notes) = &notes {
        if notes.len() > 5000 {
            return Err(AppError::bad_request("notes is too long"));
        }
    }
    let status = optional_enum(
        body,
        "status",
        &["active", "archived", "incomplete", "complete"],
    )?
    .unwrap_or(existing.status);
    let row = sqlx::query_as::<_, KitRow>(&format!(
        "UPDATE kits SET name = $2, location_id = $3, notes = $4, status = $5::kit_status
         WHERE id = $1 RETURNING {KIT_COLUMNS}"
    ))
    .bind(id)
    .bind(name)
    .bind(location_id)
    .bind(notes)
    .bind(status)
    .fetch_one(pool)
    .await?;
    Ok(kit_json(row))
}

pub async fn delete_kit(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let existing = load_kit(pool, id).await?;
    require_member(pool, existing.workspace_id, user_id).await?;
    sqlx::query("UPDATE kits SET deleted_at = NOW(), status = 'archived' WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create_from_template(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<KitJson, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    assert_limit(
        pool,
        user_id,
        "SELECT count(*)::bigint FROM kits WHERE workspace_id = $1 AND deleted_at IS NULL",
        workspace_id,
        FREE_KITS,
        format!("Free plan allows {FREE_KITS} kits"),
    )
    .await?;
    let template_id = required_uuid(body, "templateId")?;
    let template_name: Option<(String,)> =
        sqlx::query_as("SELECT name FROM kit_templates WHERE id = $1")
            .bind(template_id)
            .fetch_optional(pool)
            .await?;
    let template_name = template_name
        .map(|row| row.0)
        .ok_or_else(|| AppError::not_found("Template not found"))?;
    let custom_name = optional_trimmed(body, "name", 255)?.flatten();
    let location_id = optional_uuid(body, "locationId")?.flatten();
    let name = custom_name.unwrap_or(template_name);
    let mut tx = pool.begin().await?;
    let kit = sqlx::query_as::<_, KitRow>(&format!(
        "INSERT INTO kits (workspace_id, name, location_id, template_id, status)
         VALUES ($1, $2, $3, $4, 'incomplete')
         RETURNING {KIT_COLUMNS}"
    ))
    .bind(workspace_id)
    .bind(name)
    .bind(location_id)
    .bind(template_id)
    .fetch_one(&mut *tx)
    .await?;
    let items = sqlx::query_as::<_, (Option<Uuid>, Option<String>, String, i32)>(
        "SELECT supply_id, freeform_name, supply_name, required_quantity
         FROM kit_template_items WHERE template_id = $1",
    )
    .bind(template_id)
    .fetch_all(&mut *tx)
    .await?;
    if !is_premium(pool, user_id).await? {
        let (count,): (i64,) =
            sqlx::query_as("SELECT count(*)::bigint FROM inventory_items WHERE workspace_id = $1")
                .bind(workspace_id)
                .fetch_one(&mut *tx)
                .await?;
        if count + items.len() as i64 > FREE_ITEMS {
            return Err(AppError::forbidden(format!(
                "Free plan allows {FREE_ITEMS} inventory items"
            )));
        }
    }
    for (supply_id, freeform_name, supply_name, required_quantity) in items {
        let freeform = if supply_id.is_some() {
            None
        } else {
            Some(freeform_name.unwrap_or_else(|| supply_name.clone()))
        };
        sqlx::query(
            "INSERT INTO inventory_items
             (workspace_id, kit_id, supply_id, freeform_name, supply_name, required_quantity, actual_quantity, status)
             VALUES ($1, $2, $3, $4, $5, $6, 0, 'missing')",
        )
        .bind(workspace_id)
        .bind(kit.id)
        .bind(supply_id)
        .bind(freeform)
        .bind(supply_name)
        .bind(required_quantity)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(kit_json(kit))
}

pub fn derive_status(
    required: Option<i32>,
    actual: Option<i32>,
    expiration: Option<DateTime<Utc>>,
) -> &'static str {
    if expiration.is_some_and(|date| date < Utc::now()) {
        return "expired";
    }
    let required = required.unwrap_or(0);
    let actual = actual.unwrap_or(0);
    if required <= 0 {
        return if actual > 0 { "complete" } else { "missing" };
    }
    if actual <= 0 {
        return "missing";
    }
    if actual >= required {
        "complete"
    } else {
        "partial"
    }
}

pub async fn list_items(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    kit_id: Option<Uuid>,
) -> Result<Vec<ItemJson>, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    let rows = if let Some(kit_id) = kit_id {
        sqlx::query_as::<_, ItemRow>(&format!(
            "SELECT {ITEM_COLUMNS} FROM inventory_items WHERE workspace_id = $1 AND kit_id = $2 ORDER BY created_at"
        ))
        .bind(workspace_id)
        .bind(kit_id)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, ItemRow>(&format!(
            "SELECT {ITEM_COLUMNS} FROM inventory_items WHERE workspace_id = $1 ORDER BY created_at"
        ))
        .bind(workspace_id)
        .fetch_all(pool)
        .await?
    };
    Ok(rows.into_iter().map(item_json).collect())
}

pub async fn create_item(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<ItemJson, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    assert_limit(
        pool,
        user_id,
        "SELECT count(*)::bigint FROM inventory_items WHERE workspace_id = $1",
        workspace_id,
        FREE_ITEMS,
        format!("Free plan allows {FREE_ITEMS} inventory items"),
    )
    .await?;
    let supply_id = optional_uuid(body, "supplyId")?.flatten();
    let freeform_in = optional_trimmed(body, "freeformName", 255)?.flatten();
    let supply_name_in = optional_trimmed(body, "supplyName", 255)?.flatten();
    if supply_id.is_none() && freeform_in.is_none() && supply_name_in.is_none() {
        return Err(AppError::bad_request(
            "Provide supplyId, freeformName, or supplyName",
        ));
    }
    let mut supply_name = supply_name_in
        .clone()
        .or_else(|| freeform_in.clone())
        .unwrap_or_else(|| "Item".into());
    let mut category_id = optional_uuid(body, "supplyCategoryId")?.flatten();
    if let Some(supply_id) = supply_id {
        let supply = sqlx::query_as::<_, (String, Option<Uuid>)>(
            "SELECT name, category_id FROM supplies WHERE id = $1",
        )
        .bind(supply_id)
        .fetch_optional(pool)
        .await?;
        if let Some((name, category)) = supply {
            supply_name = name;
            category_id = category;
        }
    }
    let freeform_name = if supply_id.is_some() {
        None
    } else {
        Some(freeform_in.unwrap_or_else(|| supply_name.clone()))
    };
    let required = optional_qty(body, "requiredQuantity")?;
    let actual = optional_qty(body, "actualQuantity")?;
    let expiration = optional_time(body, "expirationDate")?;
    let status = match optional_enum(
        body,
        "status",
        &[
            "complete", "partial", "missing", "used", "disposed", "expired",
        ],
    )? {
        Some(status) => status,
        None => derive_status(required, actual, expiration).to_string(),
    };
    let notes = optional_string(body, "notes")?.flatten();
    check_notes(notes.as_deref())?;
    let row = sqlx::query_as::<_, ItemRow>(&format!(
        "INSERT INTO inventory_items
         (workspace_id, kit_id, supply_id, freeform_name, supply_name, supply_category_id, location_id,
          required_quantity, actual_quantity, status, expiration_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::inventory_item_status, $11, $12)
         RETURNING {ITEM_COLUMNS}"
    ))
    .bind(workspace_id)
    .bind(optional_uuid(body, "kitId")?.flatten())
    .bind(supply_id)
    .bind(freeform_name)
    .bind(supply_name)
    .bind(category_id)
    .bind(optional_uuid(body, "locationId")?.flatten())
    .bind(required)
    .bind(actual)
    .bind(status)
    .bind(expiration)
    .bind(notes)
    .fetch_one(pool)
    .await?;
    Ok(item_json(row))
}

pub async fn update_item(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    body: &Value,
) -> Result<ItemJson, AppError> {
    let existing = sqlx::query_as::<_, ItemRow>(&format!(
        "SELECT {ITEM_COLUMNS} FROM inventory_items WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("Item not found"))?;
    require_member(pool, existing.workspace_id, user_id).await?;
    let supply_id = match optional_uuid(body, "supplyId")? {
        None => existing.supply_id,
        Some(value) => value,
    };
    let mut freeform = match optional_trimmed(body, "freeformName", 255)? {
        None => existing.freeform_name,
        Some(value) => value,
    };
    if supply_id.is_some() {
        freeform = None;
    }
    let supply_name = optional_trimmed(body, "supplyName", 255)?
        .flatten()
        .unwrap_or(existing.supply_name);
    let required = match optional_qty_field(body, "requiredQuantity")? {
        None => existing.required_quantity,
        Some(value) => value,
    };
    let actual = match optional_qty_field(body, "actualQuantity")? {
        None => existing.actual_quantity,
        Some(value) => value,
    };
    let expiration = match optional_time_field(body, "expirationDate")? {
        None => existing.expiration_date,
        Some(value) => value,
    };
    let status = match optional_enum(
        body,
        "status",
        &[
            "complete", "partial", "missing", "used", "disposed", "expired",
        ],
    )? {
        Some(status) => status,
        None => derive_status(required, actual, expiration).to_string(),
    };
    let location_id = match optional_uuid(body, "locationId")? {
        None => existing.location_id,
        Some(value) => value,
    };
    let kit_id = match optional_uuid(body, "kitId")? {
        None => existing.kit_id,
        Some(value) => value,
    };
    let notes = match optional_string(body, "notes")? {
        None => existing.notes,
        Some(value) => value,
    };
    check_notes(notes.as_deref())?;
    let row = sqlx::query_as::<_, ItemRow>(&format!(
        "UPDATE inventory_items SET kit_id = $2, supply_id = $3, freeform_name = $4, supply_name = $5,
         location_id = $6, required_quantity = $7, actual_quantity = $8, status = $9::inventory_item_status,
         expiration_date = $10, notes = $11
         WHERE id = $1 RETURNING {ITEM_COLUMNS}"
    ))
    .bind(id)
    .bind(kit_id)
    .bind(supply_id)
    .bind(freeform)
    .bind(supply_name)
    .bind(location_id)
    .bind(required)
    .bind(actual)
    .bind(status)
    .bind(expiration)
    .bind(notes)
    .fetch_one(pool)
    .await?;
    Ok(item_json(row))
}

pub async fn delete_item(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let existing = sqlx::query_as::<_, ItemRow>(&format!(
        "SELECT {ITEM_COLUMNS} FROM inventory_items WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("Item not found"))?;
    require_member(pool, existing.workspace_id, user_id).await?;
    sqlx::query("DELETE FROM inventory_items WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn expiring_items(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
    within_days: i64,
) -> Result<Vec<ItemJson>, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    let until = add_days(start_of_utc_day(Utc::now()), within_days);
    let rows = sqlx::query_as::<_, ItemRow>(&format!(
        "SELECT {ITEM_COLUMNS} FROM inventory_items
         WHERE workspace_id = $1 AND expiration_date IS NOT NULL AND expiration_date <= $2
         ORDER BY expiration_date"
    ))
    .bind(workspace_id)
    .bind(until)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(item_json).collect())
}

pub async fn low_stock_items(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<ItemJson>, AppError> {
    require_member(pool, workspace_id, user_id).await?;
    let rows = sqlx::query_as::<_, ItemRow>(&format!(
        "SELECT {ITEM_COLUMNS} FROM inventory_items
         WHERE workspace_id = $1 AND (
           status::text = 'missing' OR status::text = 'partial' OR
           (required_quantity IS NOT NULL AND COALESCE(actual_quantity, 0) < required_quantity)
         )
         ORDER BY supply_name"
    ))
    .bind(workspace_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(item_json).collect())
}

pub async fn categories(pool: &PgPool) -> Result<Vec<CategoryJson>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, Option<i32>)>(
        "SELECT id, name, description, icon_name, sort_order
         FROM supply_categories WHERE is_active = true ORDER BY sort_order NULLS LAST, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, name, description, icon_name, sort_order)| CategoryJson {
                id,
                name,
                description,
                icon_name,
                sort_order: sort_order.unwrap_or(0),
            },
        )
        .collect())
}

pub async fn supplies(pool: &PgPool, q: Option<&str>) -> Result<Vec<SupplyJson>, AppError> {
    let rows = if let Some(q) = q.filter(|q| !q.trim().is_empty()) {
        sqlx::query_as::<
            _,
            (
                Uuid,
                Option<Uuid>,
                String,
                Option<String>,
                Option<String>,
                Option<i32>,
            ),
        >(
            "SELECT id, category_id, name, description, default_unit, typical_shelf_life_days
             FROM supplies WHERE is_active = true AND name ILIKE $1 ORDER BY name",
        )
        .bind(format!("%{q}%"))
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<
            _,
            (
                Uuid,
                Option<Uuid>,
                String,
                Option<String>,
                Option<String>,
                Option<i32>,
            ),
        >(
            "SELECT id, category_id, name, description, default_unit, typical_shelf_life_days
             FROM supplies WHERE is_active = true ORDER BY name",
        )
        .fetch_all(pool)
        .await?
    };
    Ok(rows
        .into_iter()
        .map(
            |(id, category_id, name, description, default_unit, typical_shelf_life_days)| {
                SupplyJson {
                    id,
                    category_id,
                    name,
                    description,
                    default_unit,
                    typical_shelf_life_days,
                }
            },
        )
        .collect())
}

pub async fn list_notifications(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<NotificationJson>, AppError> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Option<Uuid>,
            String,
            String,
            String,
            Option<Value>,
            bool,
            DateTime<Utc>,
        ),
    >(
        "SELECT id, user_id, workspace_id, type, title, message, data, is_read, created_at
         FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, user_id, workspace_id, kind, title, message, data, is_read, created_at)| {
                NotificationJson {
                    id,
                    user_id,
                    workspace_id,
                    r#type: kind,
                    title,
                    message,
                    data,
                    is_read,
                    created_at: iso(created_at),
                }
            },
        )
        .collect())
}

pub async fn mark_notification_read(
    pool: &PgPool,
    user_id: Uuid,
    id: Uuid,
) -> Result<NotificationJson, AppError> {
    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Option<Uuid>,
            String,
            String,
            String,
            Option<Value>,
            bool,
            DateTime<Utc>,
        ),
    >(
        "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, workspace_id, type, title, message, data, is_read, created_at",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("Notification not found"))?;
    Ok(NotificationJson {
        id: row.0,
        user_id: row.1,
        workspace_id: row.2,
        r#type: row.3,
        title: row.4,
        message: row.5,
        data: row.6,
        is_read: row.7,
        created_at: iso(row.8),
    })
}

pub async fn subscription_status(pool: &PgPool, user_id: Uuid) -> Result<Value, AppError> {
    let user = get_user(pool, user_id).await?;
    let premium = is_premium(pool, user_id).await?;
    Ok(serde_json::json!({
        "tier": if premium { "premium" } else { "free" },
        "status": user.subscription_status,
        "expiresAt": iso_opt(user.subscription_expires_at),
        "entitlement": if premium { Some("everredi-pro") } else { None::<&str> },
    }))
}

pub async fn apply_webhook(
    pool: &PgPool,
    payload: &Value,
    entitlement_id: &str,
) -> Result<Value, AppError> {
    let app_user_id = billing::app_user_id(payload);
    if app_user_id.is_empty() {
        return Ok(serde_json::json!({ "handled": false, "reason": "missing app_user_id" }));
    }
    let Some(user_id) = resolve_user(pool, &app_user_id).await? else {
        return Ok(serde_json::json!({ "handled": false, "reason": "unknown user" }));
    };
    sqlx::query(
        "INSERT INTO revenuecat_customers (user_id, app_user_id) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET app_user_id = EXCLUDED.app_user_id",
    )
    .bind(user_id)
    .bind(&app_user_id)
    .execute(pool)
    .await?;
    let effect = billing::webhook_effect(
        &billing::event_type(payload),
        &billing::entitlement_ids(payload),
        entitlement_id,
    );
    let expires = billing::expiration_at(payload);
    match effect {
        WebhookEffect::Grant => {
            set_entitlement(pool, user_id, true, expires, "active").await?;
            Ok(serde_json::json!({
                "handled": true,
                "premium": true,
                "entitlementId": entitlement_id,
            }))
        }
        WebhookEffect::Revoke => {
            set_entitlement(pool, user_id, false, expires, "expired").await?;
            Ok(serde_json::json!({
                "handled": true,
                "premium": false,
                "entitlementId": entitlement_id,
            }))
        }
        WebhookEffect::Ignore => Ok(serde_json::json!({
            "handled": true,
            "premium": false,
            "type": billing::event_type(payload),
            "entitlementId": entitlement_id,
        })),
    }
}

async fn resolve_user(pool: &PgPool, app_user_id: &str) -> Result<Option<Uuid>, AppError> {
    if let Ok(id) = Uuid::parse_str(app_user_id) {
        let found: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        if found.is_some() {
            return Ok(Some(id));
        }
    }
    let mapped: Option<(Uuid,)> =
        sqlx::query_as("SELECT user_id FROM revenuecat_customers WHERE app_user_id = $1")
            .bind(app_user_id)
            .fetch_optional(pool)
            .await?;
    Ok(mapped.map(|row| row.0))
}

async fn set_entitlement(
    pool: &PgPool,
    user_id: Uuid,
    premium: bool,
    expires: Option<DateTime<Utc>>,
    status: &str,
) -> Result<(), AppError> {
    let tier = if premium { "premium" } else { "free" };
    sqlx::query(
        "UPDATE users SET subscription_tier = $2, subscription_status = $3, subscription_expires_at = $4
         WHERE id = $1",
    )
    .bind(user_id)
    .bind(tier)
    .bind(status)
    .bind(expires)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn run_alerts(pool: &PgPool, within_days: i64) -> Result<Value, AppError> {
    let ids: Vec<(Uuid,)> = sqlx::query_as("SELECT id FROM workspaces")
        .fetch_all(pool)
        .await?;
    let mut results = Vec::new();
    let mut notified_users = 0i64;
    for (workspace_id,) in ids {
        let result = run_workspace_alerts(pool, workspace_id, within_days).await?;
        notified_users += result.1;
        results.push(result.0);
    }
    Ok(serde_json::json!({
        "workspaces": results.len(),
        "notifiedUsers": notified_users,
        "results": results,
    }))
}

async fn run_workspace_alerts(
    pool: &PgPool,
    workspace_id: Uuid,
    within_days: i64,
) -> Result<(Value, i64), AppError> {
    let until = add_days(start_of_utc_day(Utc::now()), within_days);
    let (expiring,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint FROM inventory_items
         WHERE workspace_id = $1 AND expiration_date IS NOT NULL AND expiration_date <= $2",
    )
    .bind(workspace_id)
    .bind(until)
    .fetch_one(pool)
    .await?;
    let (low_stock,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint FROM inventory_items
         WHERE workspace_id = $1 AND (
           status::text = 'missing' OR status::text = 'partial' OR
           (required_quantity IS NOT NULL AND COALESCE(actual_quantity, 0) < required_quantity)
         )",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await?;
    let members: Vec<(Uuid,)> =
        sqlx::query_as("SELECT user_id FROM workspace_members WHERE workspace_id = $1")
            .bind(workspace_id)
            .fetch_all(pool)
            .await?;
    let mut notified = 0i64;
    for (user_id,) in members {
        let mut wrote = false;
        if expiring > 0 {
            insert_notification(
                pool,
                user_id,
                workspace_id,
                "expiration",
                "Items expiring soon",
                &format!(
                    "{expiring} item{} expire within 30 days",
                    if expiring == 1 { "" } else { "s" }
                ),
                expiring,
            )
            .await?;
            wrote = true;
        }
        if low_stock > 0 {
            insert_notification(
                pool,
                user_id,
                workspace_id,
                "low_stock",
                "Low stock",
                &format!(
                    "{low_stock} item{} are below required quantity",
                    if low_stock == 1 { "" } else { "s" }
                ),
                low_stock,
            )
            .await?;
            wrote = true;
        }
        if wrote {
            notified += 1;
        }
    }
    Ok((
        serde_json::json!({
            "workspaceId": workspace_id,
            "expiring": expiring,
            "lowStock": low_stock,
            "notifiedUsers": notified,
        }),
        notified,
    ))
}

async fn insert_notification(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    kind: &str,
    title: &str,
    message: &str,
    count: i64,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO notifications (user_id, workspace_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(kind)
    .bind(title)
    .bind(message)
    .bind(serde_json::json!({ "count": count }))
    .execute(pool)
    .await?;
    Ok(())
}

fn object(body: &Value) -> Result<&Map<String, Value>, AppError> {
    body.as_object()
        .ok_or_else(|| AppError::bad_request("Expected a JSON object"))
}

fn optional_string(body: &Value, key: &str) -> Result<Option<Option<String>>, AppError> {
    let Some(value) = object(body)?.get(key) else {
        return Ok(None);
    };
    match value {
        Value::Null => Ok(Some(None)),
        Value::String(text) => Ok(Some(Some(text.clone()))),
        _ => Err(AppError::bad_request(format!("{key} must be a string"))),
    }
}

fn optional_trimmed(
    body: &Value,
    key: &str,
    max: usize,
) -> Result<Option<Option<String>>, AppError> {
    let Some(value) = optional_string(body, key)? else {
        return Ok(None);
    };
    let Some(text) = value else {
        return Ok(Some(None));
    };
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err(AppError::bad_request(format!("{key} is required")));
    }
    if text.len() > max {
        return Err(AppError::bad_request(format!("{key} is too long")));
    }
    Ok(Some(Some(text)))
}

fn required_trimmed(body: &Value, key: &str, max: usize) -> Result<String, AppError> {
    match optional_trimmed(body, key, max)? {
        Some(Some(value)) => Ok(value),
        _ => Err(AppError::bad_request(format!("{key} is required"))),
    }
}

fn optional_bool(body: &Value, key: &str) -> Result<Option<bool>, AppError> {
    let Some(value) = object(body)?.get(key) else {
        return Ok(None);
    };
    value
        .as_bool()
        .map(Some)
        .ok_or_else(|| AppError::bad_request(format!("{key} must be a boolean")))
}

fn optional_uuid(body: &Value, key: &str) -> Result<Option<Option<Uuid>>, AppError> {
    let Some(value) = object(body)?.get(key) else {
        return Ok(None);
    };
    match value {
        Value::Null => Ok(Some(None)),
        Value::String(text) => {
            let id = Uuid::parse_str(text)
                .map_err(|_| AppError::bad_request(format!("{key} must be a uuid")))?;
            Ok(Some(Some(id)))
        }
        _ => Err(AppError::bad_request(format!("{key} must be a uuid"))),
    }
}

fn required_uuid(body: &Value, key: &str) -> Result<Uuid, AppError> {
    match optional_uuid(body, key)? {
        Some(Some(id)) => Ok(id),
        _ => Err(AppError::bad_request(format!("{key} is required"))),
    }
}

fn optional_enum(body: &Value, key: &str, allowed: &[&str]) -> Result<Option<String>, AppError> {
    let Some(value) = optional_string(body, key)? else {
        return Ok(None);
    };
    let Some(value) = value else {
        return Err(AppError::bad_request(format!("{key} is required")));
    };
    if !allowed.contains(&value.as_str()) {
        return Err(AppError::bad_request(format!("{key} is invalid")));
    }
    Ok(Some(value))
}

fn optional_qty(body: &Value, key: &str) -> Result<Option<i32>, AppError> {
    Ok(optional_qty_field(body, key)?.flatten())
}

fn optional_qty_field(body: &Value, key: &str) -> Result<Option<Option<i32>>, AppError> {
    let Some(value) = object(body)?.get(key) else {
        return Ok(None);
    };
    match value {
        Value::Null => Ok(Some(None)),
        Value::Number(number) => {
            let qty = number
                .as_i64()
                .filter(|qty| *qty >= 0 && *qty <= i32::MAX as i64)
                .ok_or_else(|| {
                    AppError::bad_request(format!("{key} must be a non-negative integer"))
                })?;
            Ok(Some(Some(qty as i32)))
        }
        _ => Err(AppError::bad_request(format!(
            "{key} must be a non-negative integer"
        ))),
    }
}

fn optional_time(body: &Value, key: &str) -> Result<Option<DateTime<Utc>>, AppError> {
    Ok(optional_time_field(body, key)?.flatten())
}

fn optional_time_field(body: &Value, key: &str) -> Result<Option<Option<DateTime<Utc>>>, AppError> {
    let Some(value) = optional_string(body, key)? else {
        return Ok(None);
    };
    let Some(value) = value else {
        return Ok(Some(None));
    };
    let parsed = parse_rfc3339(&value)
        .map_err(|_| AppError::bad_request(format!("{key} must be an ISO datetime")))?;
    Ok(Some(Some(parsed)))
}

fn check_notes(notes: Option<&str>) -> Result<(), AppError> {
    if notes.is_some_and(|notes| notes.len() > 5000) {
        return Err(AppError::bad_request("notes is too long"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expired_beats_quantity() {
        let past = Utc::now() - chrono::Duration::days(1);
        assert_eq!(derive_status(Some(1), Some(1), Some(past)), "expired");
    }

    #[test]
    fn short_quantity_is_partial() {
        assert_eq!(derive_status(Some(4), Some(1), None), "partial");
    }
}
