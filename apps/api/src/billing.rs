use chrono::{DateTime, Utc};
use serde_json::Value;

/// What a RevenueCat event should do to `everredi-pro`.
/// Cancellation does not remove Pro. Access lasts until expiration.
#[derive(Debug, PartialEq, Eq)]
pub enum WebhookEffect {
    Grant,
    Revoke,
    Ignore,
}

pub fn webhook_effect(
    event_type: &str,
    entitlement_ids: &[String],
    expected: &str,
) -> WebhookEffect {
    let granted = if !entitlement_ids.is_empty() {
        entitlement_ids
            .iter()
            .any(|id| id == expected || id == "everredi_pro")
    } else {
        [
            "INITIAL_PURCHASE",
            "RENEWAL",
            "UNCANCELLATION",
            "NON_RENEWING_PURCHASE",
        ]
        .iter()
        .any(|kind| event_type.contains(kind))
    };
    if granted {
        return WebhookEffect::Grant;
    }
    if event_type.contains("EXPIRATION") {
        return WebhookEffect::Revoke;
    }
    WebhookEffect::Ignore
}

pub fn event_body(payload: &Value) -> &Value {
    payload.get("event").unwrap_or(payload)
}

pub fn event_type(payload: &Value) -> String {
    let event = event_body(payload);
    event
        .get("type")
        .or_else(|| payload.get("type"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

pub fn app_user_id(payload: &Value) -> String {
    let event = event_body(payload);
    for key in ["app_user_id", "appUserId"] {
        if let Some(value) = event.get(key).and_then(Value::as_str) {
            if !value.is_empty() {
                return value.to_string();
            }
        }
    }
    payload
        .get("app_user_id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

pub fn entitlement_ids(payload: &Value) -> Vec<String> {
    let event = event_body(payload);
    let list = event
        .get("entitlement_ids")
        .or_else(|| event.get("entitlements"));
    match list {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

pub fn expiration_at(payload: &Value) -> Option<DateTime<Utc>> {
    let event = event_body(payload);
    if let Some(ms) = event.get("expiration_at_ms") {
        let millis = ms
            .as_i64()
            .or_else(|| ms.as_str().and_then(|value| value.parse().ok()));
        if let Some(millis) = millis {
            return DateTime::from_timestamp_millis(millis);
        }
    }
    event
        .get("expiration_at")
        .and_then(Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifetime_and_subscription_grant_without_an_entitlement_list() {
        for kind in [
            "INITIAL_PURCHASE",
            "RENEWAL",
            "UNCANCELLATION",
            "NON_RENEWING_PURCHASE",
        ] {
            assert_eq!(
                webhook_effect(kind, &[], "everredi-pro"),
                WebhookEffect::Grant
            );
        }
    }

    #[test]
    fn cancellation_does_not_revoke() {
        assert_eq!(
            webhook_effect("CANCELLATION", &[], "everredi-pro"),
            WebhookEffect::Ignore
        );
    }

    #[test]
    fn expiration_revokes_when_the_entitlement_is_gone() {
        assert_eq!(
            webhook_effect("EXPIRATION", &[], "everredi-pro"),
            WebhookEffect::Revoke
        );
    }

    #[test]
    fn listed_entitlement_grants_even_on_cancellation() {
        assert_eq!(
            webhook_effect("CANCELLATION", &["everredi-pro".into()], "everredi-pro"),
            WebhookEffect::Grant
        );
    }
}
