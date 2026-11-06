use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};

use crate::time::now_iso;

pub fn ok<T: Serialize>(data: T) -> Json<Value> {
    ok_message(data, None)
}

pub fn ok_message<T: Serialize>(data: T, message: Option<&str>) -> Json<Value> {
    let mut body = json!({
        "success": true,
        "data": data,
        "timestamp": now_iso(),
    });
    if let Some(message) = message {
        body["message"] = json!(message);
    }
    Json(body)
}
