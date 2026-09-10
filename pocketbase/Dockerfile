FROM alpine:3.21

ARG PB_VERSION=0.39.10

# wget bleibt für Compose-Healthcheck (/api/health)
RUN apk add --no-cache ca-certificates unzip curl wget \
	&& curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
		-o /tmp/pb.zip \
	&& unzip /tmp/pb.zip -d /pb \
	&& chmod +x /pb/pocketbase \
	&& rm /tmp/pb.zip \
	&& apk del unzip curl

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

WORKDIR /pb
EXPOSE 8090

ENTRYPOINT ["/pb/entrypoint.sh"]
