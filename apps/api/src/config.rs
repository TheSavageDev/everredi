use std::sync::Arc;

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::error::AppError;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: Option<String>,
    pub supabase_url: Option<String>,
    pub cors_origins: Vec<String>,
    pub cron_secret: Option<String>,
    pub revenuecat_webhook_secret: Option<String>,
    pub revenuecat_entitlement_id: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url =
            std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required".to_string())?;
        Ok(Self::from_parts(database_url))
    }

    pub fn from_parts(database_url: String) -> Self {
        let cors_raw = std::env::var("CORS_ORIGIN").unwrap_or_default();
        let mut cors_origins: Vec<String> = cors_raw
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .collect();
        if cors_origins.is_empty() {
            cors_origins.push("http://localhost:3000".into());
        }
        Self {
            database_url,
            jwt_secret: nonempty("SUPABASE_JWT_SECRET"),
            supabase_url: nonempty("SUPABASE_URL"),
            cors_origins,
            cron_secret: nonempty("CRON_SECRET"),
            revenuecat_webhook_secret: nonempty("REVENUECAT_WEBHOOK_SECRET"),
            revenuecat_entitlement_id: nonempty("REVENUECAT_ENTITLEMENT_ID")
                .unwrap_or_else(|| "everredi-pro".into()),
        }
    }
}

fn nonempty(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub jwks: Arc<RwLock<Option<jsonwebtoken::jwk::JwkSet>>>,
}

impl AppState {
    pub async fn connect(config: Config) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&config.database_url)
            .await?;
        Ok(Self::from_pool(config, pool))
    }

    pub fn lazy(config: Config) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new().connect_lazy(&config.database_url)?;
        Ok(Self::from_pool(config, pool))
    }

    fn from_pool(config: Config, pool: PgPool) -> Self {
        Self {
            pool,
            config: Arc::new(config),
            jwks: Arc::new(RwLock::new(None)),
        }
    }
}

pub fn require_workspace_id(value: Option<uuid::Uuid>) -> Result<uuid::Uuid, AppError> {
    value.ok_or_else(|| AppError::bad_request("workspaceId is required"))
}
