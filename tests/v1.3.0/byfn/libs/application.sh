# for setup_directory()
. libs/common.sh

start_application() {
	# rm -rf /var/run/app # initialize application data
	[ ! -d /var/run/app ] && mkdir -p /var/run/app
	chmod 777 -R /var/run/app
	setup_directory $CONFIG_JSON

	CONTROL_PARAMS=
	if [ "$_USE_SERVICE_DISCOVERY" = true ] ; then
		CONTROL_PARAMS="$CONTROL_PARAMS -e _USE_SERVICE_DISCOVERY=true"
	fi

	docker ps -a | grep app$ | awk '{print $1}' | xargs -r docker rm -f
	docker run --name app \
		   -v $PWD/node_modules:/app/node_modules \
		   -v $PWD/configs:/app/configs \
		   -v /var/run/app:/app/run \
		   -v $ARTIFACTS_DIR:/app/artifacts/src/examples \
		   -v $CRYPTO_CONFIG_DIR:/app/crypto-config \
		   -v $PWD/fabric-samples/chaincode/marbles02_private:/app/artifacts/src/examples/chaincode/go/marbles02_private \
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
		   bash -c "cd /app ; node app.js"

	sleep 3

	if docker ps | grep -q app$ ; then
		echo "app is starting."
	else
		echo "app failed to start, abort."
		docker logs app
		return 1
	fi
}

stop_application() {
	docker stop app
}
