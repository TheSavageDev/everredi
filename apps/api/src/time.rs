use chrono::{DateTime, Duration, SecondsFormat, Utc};

pub fn now_iso() -> String {
    iso(Utc::now())
}

pub fn iso(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn iso_opt(dt: Option<DateTime<Utc>>) -> Option<String> {
    dt.map(iso)
}

pub fn start_of_utc_day(now: DateTime<Utc>) -> DateTime<Utc> {
    now.date_naive()
        .and_hms_opt(0, 0, 0)
        .expect("midnight")
        .and_utc()
}

pub fn add_days(dt: DateTime<Utc>, days: i64) -> DateTime<Utc> {
    dt + Duration::days(days)
}

pub fn parse_rfc3339(value: &str) -> Result<DateTime<Utc>, ()> {
    DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| ())
}
