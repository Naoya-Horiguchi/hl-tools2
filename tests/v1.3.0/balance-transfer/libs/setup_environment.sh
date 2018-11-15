cd $(dirname $BASH_SOURCE)

# . libs/env.sh

# prepare images
TAG=1.3.0

docker pull hyperledger/fabric-peer:$TAG
docker pull hyperledger/fabric-orderer:$TAG
docker pull hyperledger/fabric-tools:$TAG
docker pull hyperledger/fabric-ca:$TAG

docker tag hyperledger/fabric-peer:$TAG     hyperledger/fabric-peer:latest
docker tag hyperledger/fabric-orderer:$TAG  hyperledger/fabric-orderer:latest
docker tag hyperledger/fabric-tools:$TAG    hyperledger/fabric-tools:latest
docker tag hyperledger/fabric-ca:$TAG       hyperledger/fabric-ca:latest

# Assuming that target docker images are tagged as "latest".
# Maybe you need to run pull_fabric_images_from_ecr.sh in advance.

docker ps | grep test_run_for_copy | awk '{print $1}' | xargs -r docker rm -f
docker run -d --name test_run_for_copy hyperledger/fabric-tools:latest
for bin in configtxgen cryptogen configtxlator idemixgen discover ; do
	sudo docker cp test_run_for_copy:/usr/local/bin/$bin /usr/local/bin
done
docker rm -f test_run_for_copy
