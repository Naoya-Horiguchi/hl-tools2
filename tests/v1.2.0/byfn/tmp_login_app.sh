. libs/env.sh

docker ps -a | grep app$ | awk '{print $1}' | xargs -r docker rm -f
docker run --name app \
	   -v $PWD/node_modules:/app/node_modules \
	   -v $PWD/fabric-samples/first-network/crypto-config:/app/crypto-config \
	   -v /var/run/app:/app/run \
	   -v $PWD/examples:/app/artifacts/src/examples \
	   -v $CRYPTO_CONFIG_DIR:/app/crypto-config \
	   -p 4000:4000 \
	   --detach \
	   --link peer1-org1:peer1-org1 \
	   --link ica-org1:ica-org1 \
	   --net $DOCKER_NETWORK \
	   -e CONFIG_JSON=$CONFIG_JSON \
	   -e CONFIG_JWT=true \
	   -e PEER_CLIENT_TLS=false \
	   -e LOGLEVEL=$LOGLEVEL $CONTROL_PARAMS \
	   hlf/app \
	   bash -c "cd /app ; sleep 1000"
