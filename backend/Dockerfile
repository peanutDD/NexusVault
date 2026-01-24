# Backend Dockerfile
FROM rust:1.75 as builder

WORKDIR /app

# Copy dependency files
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY build.rs ./

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/file-storage-backend /app/file-storage-backend

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Run the application
CMD ["./file-storage-backend"]
