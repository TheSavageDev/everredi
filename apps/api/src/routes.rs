use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::{bearer, AuthUser, CronAuth};
use crate::config::{require_workspace_id, AppState};
use crate::error::AppError;
use crate::http::{ok, ok_message};
use crate::store;

#[derive(Deserialize)]
struct WorkspaceQuery {
    #[serde(rename = "workspaceId")]
    workspace_id: Option<Uuid>,
    #[serde(rename = "kitId")]
    kit_id: Option<Uuid>,
    #[serde(rename = "withinDays")]
    within_days: Option<i64>,
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

pub fn router(state: AppState) -> Router {
    let cors = cors_layer(&state.config.cors_origins);
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/create-or-update", post(create_or_update))
        .route("/api/users/me", get(me).put(update_me))
        .route("/api/workspaces", get(list_workspaces))
        .route("/api/locations", get(list_locations).post(create_location))
        .route(
            "/api/locations/:id",
            axum::routing::put(update_location).delete(delete_location),
        )
        .route("/api/supply-categories", get(categories))
        .route("/api/supplies", get(supplies))
        .route("/api/kits/templates", get(templates))
        .route("/api/kits/from-template", post(from_template))
        .route("/api/kits", get(list_kits).post(create_kit))
        .route(
            "/api/kits/:id",
            get(get_kit).put(update_kit).delete(delete_kit),
        )
        .route("/api/inventory", get(list_items).post(create_item))
        .route("/api/inventory/expiring", get(expiring))
        .route("/api/inventory/low-stock", get(low_stock))
        .route(
            "/api/inventory/:id",
            axum::routing::put(update_item).delete(delete_item),
        )
        .route("/api/notifications", get(list_notifications))
        .route("/api/notifications/:id/read", post(mark_read))
        .route("/api/subscriptions/status", get(subscription_status))
        .route(
            "/api/subscriptions/revenuecat/webhook",
            post(revenuecat_webhook),
        )
        .route("/api/internal/cron/alerts", get(cron_alerts))
        .fallback(not_found)
        .with_state(state)
        .layer(cors)
}

fn cors_layer(origins: &[String]) -> tower_http::cors::CorsLayer {
    use axum::http::{HeaderValue, Method};
    let methods = [
        Method::GET,
        Method::POST,
        Method::PUT,
        Method::DELETE,
        Method::OPTIONS,
    ];
    let headers = [
        axum::http::header::AUTHORIZATION,
        axum::http::header::CONTENT_TYPE,
        axum::http::header::ACCEPT,
    ];
    if origins.iter().any(|origin| origin == "*") {
        return tower_http::cors::CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods(methods)
            .allow_headers(headers);
    }
    let values: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();
    tower_http::cors::CorsLayer::new()
        .allow_origin(values)
        .allow_methods(methods)
        .allow_credentials(true)
        .allow_headers(headers)
}

async fn not_found() -> AppError {
    AppError::not_found("Not found")
}

async fn health() -> Json<Value> {
    ok(json!({ "status": "ok" }))
}

async fn create_or_update(
    State(state): State<AppState>,
    user: AuthUser,
    body: Option<Json<Value>>,
) -> Result<Json<Value>, AppError> {
    let body = body.map(|Json(value)| value).unwrap_or_else(|| json!({}));
    let saved = store::upsert_user(&state.pool, user.id, &user.email, &body).await?;
    let workspace = store::ensure_personal_workspace(&state.pool, user.id, &user.email).await?;
    Ok(ok_message(
        json!({ "user": saved, "workspace": workspace }),
        Some("User synced"),
    ))
}

async fn me(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(ok(store::get_user_json(&state.pool, user.id).await?))
}

async fn update_me(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::update_me(&state.pool, user.id, &body).await?))
}

async fn list_workspaces(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::list_workspaces(&state.pool, user.id).await?))
}

async fn list_locations(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::list_locations(
        &state.pool,
        workspace_id,
        user.id,
    )
    .await?))
}

async fn create_location(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::create_location(
        &state.pool,
        workspace_id,
        user.id,
        &body,
    )
    .await?))
}

async fn update_location(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(
        store::update_location(&state.pool, id, user.id, &body).await?
    ))
}

async fn delete_location(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    store::delete_location(&state.pool, id, user.id).await?;
    Ok(ok(Value::Null))
}

async fn categories(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::categories(&state.pool).await?))
}

async fn supplies(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::supplies(&state.pool, query.q.as_deref()).await?))
}

async fn templates(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::list_templates(&state.pool).await?))
}

async fn list_kits(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(
        store::list_kits(&state.pool, workspace_id, user.id).await?
    ))
}

async fn get_kit(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::get_kit(&state.pool, id, user.id).await?))
}

async fn create_kit(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::create_kit(
        &state.pool,
        workspace_id,
        user.id,
        &body,
    )
    .await?))
}

async fn update_kit(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::update_kit(&state.pool, id, user.id, &body).await?))
}

async fn delete_kit(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    store::delete_kit(&state.pool, id, user.id).await?;
    Ok(ok(Value::Null))
}

async fn from_template(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::create_from_template(
        &state.pool,
        workspace_id,
        user.id,
        &body,
    )
    .await?))
}

async fn list_items(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::list_items(
        &state.pool,
        workspace_id,
        user.id,
        query.kit_id,
    )
    .await?))
}

async fn create_item(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::create_item(
        &state.pool,
        workspace_id,
        user.id,
        &body,
    )
    .await?))
}

async fn update_item(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(
        store::update_item(&state.pool, id, user.id, &body).await?
    ))
}

async fn delete_item(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    store::delete_item(&state.pool, id, user.id).await?;
    Ok(ok(Value::Null))
}

async fn expiring(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    let within_days = query.within_days.unwrap_or(30);
    if within_days < 0 {
        return Err(AppError::bad_request("withinDays must be non-negative"));
    }
    Ok(ok(store::expiring_items(
        &state.pool,
        workspace_id,
        user.id,
        within_days,
    )
    .await?))
}

async fn low_stock(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let workspace_id = require_workspace_id(query.workspace_id)?;
    Ok(ok(store::low_stock_items(
        &state.pool,
        workspace_id,
        user.id,
    )
    .await?))
}

async fn list_notifications(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::list_notifications(&state.pool, user.id).await?))
}

async fn mark_read(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    Ok(ok(
        store::mark_notification_read(&state.pool, user.id, id).await?
    ))
}

async fn subscription_status(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(ok(store::subscription_status(&state.pool, user.id).await?))
}

async fn revenuecat_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let expected = state
        .config
        .revenuecat_webhook_secret
        .as_deref()
        .ok_or_else(|| AppError::unauthorized("Webhook secret is not configured"))?;
    let provided = headers
        .get("x-revenuecat-secret")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .or_else(|| bearer(&headers));
    if provided.as_deref() != Some(expected) {
        return Err(AppError::unauthorized("Invalid webhook secret"));
    }
    Ok(ok(store::apply_webhook(
        &state.pool,
        &body,
        &state.config.revenuecat_entitlement_id,
    )
    .await?))
}

async fn cron_alerts(
    State(state): State<AppState>,
    _cron: CronAuth,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, AppError> {
    let within_days = query.within_days.unwrap_or(30);
    if within_days < 0 {
        return Err(AppError::bad_request("withinDays must be non-negative"));
    }
    Ok(ok(store::run_alerts(&state.pool, within_days).await?))
}
