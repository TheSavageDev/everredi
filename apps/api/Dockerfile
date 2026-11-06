# Build from apps/api: docker build -t everredi-api apps/api
FROM rust:bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/everredi-api /usr/local/bin/everredi-api
ENV PORT=5051
EXPOSE 5051
CMD ["everredi-api"]
