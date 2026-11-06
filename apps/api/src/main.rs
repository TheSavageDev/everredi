use everredi_api::{AppState, Config};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = Config::from_env().unwrap_or_else(|err| {
        eprintln!("{err}");
        std::process::exit(1);
    });
    let state = AppState::connect(config).await.unwrap_or_else(|err| {
        eprintln!("database: {err}");
        std::process::exit(1);
    });
    let app = everredi_api::router(state);
    let port = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(5051u16);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap_or_else(|err| {
            eprintln!("bind {port}: {err}");
            std::process::exit(1);
        });
    tracing::info!("EverRedi API listening on http://localhost:{port}/api");
    axum::serve(listener, app).await.unwrap();
}
