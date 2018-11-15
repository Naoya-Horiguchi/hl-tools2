. libs/env.sh

DEVEL_OPTS="-v $PWD/node_modules:/app/node_modules"

docker run $DEVEL_OPTS --detach --name npm_installer hlf/app bash -c 'sleep 10000'
docker exec npm_installer bash -c 'npm install; npm install --global gulp-cli gulp compare-versions mkdirp'
docker rm -f npm_installer

# docker run $DEVEL_OPTS -v $FABRIC_SDK_NODE_DIR:/fabric-sdk-node --detach --name npm_installer hlf/app bash -c 'sleep 10000'
# docker exec npm_installer bash -c 'npm install; npm install --global gulp-cli gulp'
# docker exec npm_installer bash -c 'cd /fabric-sdk-node ; npm install ; npm install gulp ; gulp ca'
# docker exec npm_installer bash -c 'npm install compare-versions mkdirp'
