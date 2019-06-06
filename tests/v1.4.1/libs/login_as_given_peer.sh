get_login_option() {
    local org=$1
    local peer=$2

    local PEER0_ORG1_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
    local PEER0_ORG2_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
    local ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
    local DOCKER_PEER0_ORG1_OPT="-e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 -e CORE_PEER_LOCALMSPID=Org1MSP -e PEER0_ORG1_CA=$PEER0_ORG1_CA -e CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG1_CA -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    local DOCKER_PEER1_ORG1_OPT="-e CORE_PEER_ADDRESS=peer1.org1.example.com:8051 -e CORE_PEER_LOCALMSPID=Org1MSP -e PEER0_ORG1_CA=$PEER0_ORG1_CA -e CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG1_CA -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    local DOCKER_PEER0_ORG2_OPT="-e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 -e CORE_PEER_LOCALMSPID=Org2MSP -e PEER0_ORG2_CA=$PEER0_ORG2_CA -e CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG2_CA -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
    local DOCKER_PEER1_ORG2_OPT="-e CORE_PEER_ADDRESS=peer1.org2.example.com:10051 -e CORE_PEER_LOCALMSPID=Org2MSP -e PEER0_ORG2_CA=$PEER0_ORG2_CA -e CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG2_CA -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"

    if [ "$org" -eq 1 ] ; then
        if [ "$peer" -eq 0 ] ; then
            echo "$DOCKER_PEER0_ORG1_OPT"
        elif [ "$peer" -eq 1 ] ; then
            echo "$DOCKER_PEER1_ORG1_OPT"
        else
            return 1
        fi
    elif [ "$org" -eq 2 ] ; then
        if [ "$peer" -eq 0 ] ; then
            echo "$DOCKER_PEER0_ORG2_OPT"
        elif [ "$peer" -eq 1 ] ; then
            echo "$DOCKER_PEER1_ORG2_OPT"
        else
            return 1
        fi
    else
        return 1
    fi
    return 0
}

opts="$(get_login_option $1 $2)"
if [ "$3" ] ; then
    echo docker exec -it $opts cli bash
    docker exec -it $opts cli bash
else
    echo docker exec -it $opts cli bash
    docker exec -it $opts cli bash
fi
