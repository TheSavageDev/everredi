use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::{Duration, Utc};
use everredi_api::{router, AppState, Config};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn health_and_missing_token_respond() {
    let state = AppState::lazy(test_config("postgres://postgres@127.0.0.1/unused")).unwrap();
    let app = router(state);
    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/api/health")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
    assert_eq!(body["data"]["status"], "ok");

    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/api/kits")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["success"], false);
}

#[tokio::test]
async fn kit_routes_templates_expiration_caps_and_webhook() {
    let url = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => url,
        _ => return,
    };
    prepare(&url);
    let state = AppState::connect(test_config(&url)).await.unwrap();
    let app = router(state);
    let user_id = Uuid::new_v4();
    let token = sign(user_id, "jason@example.com");

    let (status, body) = send(
        &app,
        authed("POST", "/api/auth/create-or-update", &token, json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let workspace_id = body["data"]["workspace"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(body["data"]["workspace"]["type"], "personal");

    let (status, body) = send(
        &app,
        authed("GET", "/api/kits/templates", &token, Value::Null),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let templates = body["data"].as_array().unwrap();
    assert!(templates.len() >= 2);
    let home = templates
        .iter()
        .find(|template| template["name"] == "Home first aid")
        .unwrap();
    assert!(home["items"].as_array().unwrap().len() >= 4);

    let (status, body) = send(
        &app,
        authed(
            "POST",
            &format!("/api/kits/from-template?workspaceId={workspace_id}"),
            &token,
            json!({ "templateId": home["id"] }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let kit_id = body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(body["data"]["status"], "incomplete");

    let (status, body) = send(
        &app,
        authed(
            "GET",
            &format!("/api/kits?workspaceId={workspace_id}"),
            &token,
            Value::Null,
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"].as_array().unwrap().len(), 1);

    let (status, body) = send(
        &app,
        authed("GET", &format!("/api/kits/{kit_id}"), &token, Value::Null),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["name"], "Home first aid");

    let (status, body) = send(
        &app,
        authed(
            "GET",
            &format!("/api/inventory?workspaceId={workspace_id}&kitId={kit_id}"),
            &token,
            Value::Null,
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let item_id = body["data"][0]["id"].as_str().unwrap().to_string();
    assert_eq!(body["data"][0]["actualQuantity"], 0);

    let expires = (Utc::now() + Duration::days(10)).to_rfc3339();
    let (status, body) = send(
        &app,
        authed(
            "PUT",
            &format!("/api/inventory/{item_id}"),
            &token,
            json!({
                "actualQuantity": 1,
                "requiredQuantity": 2,
                "expirationDate": expires,
            }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["status"], "partial");
    assert!(body["data"]["expirationDate"]
        .as_str()
        .unwrap()
        .starts_with(&expires[..10]));

    let (status, body) = send(
        &app,
        authed(
            "GET",
            &format!("/api/inventory/expiring?workspaceId={workspace_id}&withinDays=30"),
            &token,
            Value::Null,
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"].as_array().unwrap().len(), 1);

    for index in 0..4 {
        let (status, body) = send(
            &app,
            authed(
                "POST",
                &format!("/api/kits?workspaceId={workspace_id}"),
                &token,
                json!({ "name": format!("Kit {index}") }),
            ),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }
    let (status, body) = send(
        &app,
        authed(
            "POST",
            &format!("/api/kits?workspaceId={workspace_id}"),
            &token,
            json!({ "name": "One too many" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(body["message"].as_str().unwrap().contains("5 kits"));

    let (status, _) = send(
        &app,
        authed(
            "POST",
            "/api/subscriptions/revenuecat/webhook",
            &token,
            json!({}),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, body) = send(
        &app,
        Request::builder()
            .method("POST")
            .uri("/api/subscriptions/revenuecat/webhook")
            .header("content-type", "application/json")
            .header("x-revenuecat-secret", "rc-secret")
            .body(Body::from(
                json!({
                    "event": {
                        "type": "NON_RENEWING_PURCHASE",
                        "app_user_id": user_id,
                    }
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["premium"], true);

    let (status, body) = send(
        &app,
        Request::builder()
            .method("POST")
            .uri("/api/subscriptions/revenuecat/webhook")
            .header("content-type", "application/json")
            .header("authorization", "Bearer rc-secret")
            .body(Body::from(
                json!({
                    "event": {
                        "type": "CANCELLATION",
                        "app_user_id": user_id,
                    }
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(
        &app,
        authed("GET", "/api/subscriptions/status", &token, Value::Null),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["tier"], "premium");
    assert_eq!(body["data"]["entitlement"], "everredi-pro");

    let (status, body) = send(
        &app,
        authed(
            "POST",
            &format!("/api/kits?workspaceId={workspace_id}"),
            &token,
            json!({ "name": "Pro kit" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

fn test_config(database_url: &str) -> Config {
    Config {
        database_url: database_url.to_string(),
        jwt_secret: Some("test-secret".into()),
        supabase_url: None,
        cors_origins: vec!["http://localhost:3000".into()],
        cron_secret: Some("cron-secret".into()),
        revenuecat_webhook_secret: Some("rc-secret".into()),
        revenuecat_entitlement_id: "everredi-pro".into(),
    }
}

fn sign(id: Uuid, email: &str) -> String {
    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &json!({
            "sub": id,
            "email": email,
            "exp": Utc::now().timestamp() + 3600,
        }),
        &jsonwebtoken::EncodingKey::from_secret(b"test-secret"),
    )
    .unwrap()
}

fn authed(method: &str, uri: &str, token: &str, body: Value) -> Request<Body> {
    let has_body = !body.is_null();
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("authorization", format!("Bearer {token}"));
    if has_body {
        builder = builder.header("content-type", "application/json");
    }
    builder
        .body(Body::from(if has_body {
            body.to_string()
        } else {
            String::new()
        }))
        .unwrap()
}

async fn send(app: &axum::Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, body)
}

fn prepare(url: &str) {
    let path =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../supabase/migrations/0001_init.sql");
    let reset = std::process::Command::new("psql")
        .arg(url)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-c")
        .arg("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        .status()
        .unwrap();
    assert!(reset.success());
    let loaded = std::process::Command::new("psql")
        .arg(url)
        .arg("-v")
        .arg("ON_ERROR_STOP=1")
        .arg("-f")
        .arg(path)
        .status()
        .unwrap();
    assert!(loaded.success());
}
