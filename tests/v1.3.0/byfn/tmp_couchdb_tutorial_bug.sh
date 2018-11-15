make setup_environment
cd ~/hyperledger/fabric-samples/first-network
echo Y | ./byfn.sh down
echo Y | ./byfn.sh up -c mychannel -s couchdb

docker exec cli bash -c "peer chaincode install -n marbles -v 1.0 -p github.com/chaincode/marbles02/go"

docker exec cli bash -c "peer chaincode instantiate -o orderer.example.com:7050 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem -C mychannel -n marbles -v 1.0 -c '{\"Args\":[\"init\"]}' -P \"OR ('Org1MSP.peer','Org2MSP.peer')\""
