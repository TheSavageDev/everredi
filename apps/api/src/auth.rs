use axum::extract::FromRef;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::HeaderMap;
use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use uuid::Uuid;

use crate::config::AppState;
use crate::error::AppError;

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    email: Option<String>,
}

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app = AppState::from_ref(state);
        let token =
            bearer(&parts.headers).ok_or_else(|| AppError::unauthorized("Missing bearer token"))?;
        verify_token(&app, &token).await
    }
}

pub struct CronAuth;

#[axum::async_trait]
impl<S> FromRequestParts<S> for CronAuth
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app = AppState::from_ref(state);
        let expected = app
            .config
            .cron_secret
            .as_deref()
            .ok_or_else(|| AppError::unauthorized("CRON_SECRET is not configured"))?;
        let token = bearer(&parts.headers).unwrap_or_default();
        if token != expected {
            return Err(AppError::unauthorized("Invalid cron secret"));
        }
        Ok(CronAuth)
    }
}

pub fn bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    let token = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .unwrap_or(value)
        .trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

pub async fn verify_token(state: &AppState, token: &str) -> Result<AuthUser, AppError> {
    let claims = if let Some(secret) = &state.config.jwt_secret {
        decode_hs256(token, secret)?
    } else {
        decode_jwks(state, token).await?
    };
    let id =
        Uuid::parse_str(&claims.sub).map_err(|_| AppError::unauthorized("Invalid token claims"))?;
    let email = claims
        .email
        .filter(|email| !email.trim().is_empty())
        .ok_or_else(|| AppError::unauthorized("Invalid token claims"))?;
    Ok(AuthUser { id, email })
}

fn decode_hs256(token: &str, secret: &str) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_aud = false;
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|_| AppError::unauthorized("Invalid token"))?;
    Ok(data.claims)
}

async fn decode_jwks(state: &AppState, token: &str) -> Result<Claims, AppError> {
    let supabase_url = state
        .config
        .supabase_url
        .as_deref()
        .ok_or_else(|| AppError::unauthorized("Auth is not configured"))?;
    let header = decode_header(token).map_err(|_| AppError::unauthorized("Invalid token"))?;
    let alg = header.alg;
    if !matches!(
        alg,
        Algorithm::RS256 | Algorithm::RS384 | Algorithm::ES256 | Algorithm::EdDSA
    ) {
        return Err(AppError::unauthorized("Invalid token"));
    }
    let kid = header
        .kid
        .ok_or_else(|| AppError::unauthorized("Invalid token"))?;
    let set = load_jwks(state, supabase_url).await?;
    let jwk = set
        .find(&kid)
        .ok_or_else(|| AppError::unauthorized("Invalid token"))?;
    let key = DecodingKey::from_jwk(jwk).map_err(|_| AppError::unauthorized("Invalid token"))?;
    let mut validation = Validation::new(alg);
    validation.validate_aud = false;
    let data = decode::<Claims>(token, &key, &validation)
        .map_err(|_| AppError::unauthorized("Invalid token"))?;
    Ok(data.claims)
}

async fn load_jwks(state: &AppState, supabase_url: &str) -> Result<JwkSet, AppError> {
    if let Some(set) = state.jwks.read().await.clone() {
        return Ok(set);
    }
    let url = format!(
        "{}/auth/v1/.well-known/jwks.json",
        supabase_url.trim_end_matches('/')
    );
    let set = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|err| AppError::Internal(err.to_string()))?
        .json::<JwkSet>()
        .await
        .map_err(|err| AppError::Internal(err.to_string()))?;
    *state.jwks.write().await = Some(set.clone());
    Ok(set)
}
