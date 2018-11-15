[ ! "$_CHANNEL_NAME" ] && _CHANNEL_NAME=mychannel
[ ! "$_CC_NAME" ] && _CC_NAME=marblesp
[ ! "$_CC_VERSION" ] && _CC_VERSION=v1
[ ! "$_USER_NAME1" ] && _USER_NAME1=Jim
[ ! "$_ORG_NAME1" ] && _ORG_NAME1=org1
[ ! "$_USER_NAME2" ] && _USER_NAME2=Barry
[ ! "$_ORG_NAME2" ] && _ORG_NAME2=org2

[ ! "$_CC_SRC_PATH" ] && __CC_SRC_PATH=examples/chaincode/go/marbles02_private/go

call_marble() {
	local user=$1
	local org=$2
	local peers="$3"
    local func=$4
	local args=$5

	echo "---> user $user at organization $org is calling function '$func' on peers ($peers) with $args" >&2
	invokeChaincode "$(get_token $user $org)" $_CHANNEL_NAME $_CC_NAME "$peers" $func "$args"
}

get_target() {
	local org=$1
	local target="[\"peer0.$org.example.com\",\"peer1.$org.example.com\"]"
	if [ "$_USE_SERVICE_DISCOVERY" == true ] ; then
		target="\"peer0.$org.example.com\""
	fi
	echo $target
}

scenario() {
  	echo "---> request_token"
	request_token $_USER_NAME1 $_ORG_NAME1
	request_token $_USER_NAME2 $_ORG_NAME2

	local org1token=$(get_token $_USER_NAME1 $_ORG_NAME1)
	local org2token=$(get_token $_USER_NAME2 $_ORG_NAME2)

	echo "---> query_channels"
	queryChannels peer0.org1.example.com $org1token

	echo "---> get Chaininfo for $_CHANNEL_NAME"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token
	queryChainInfo $_CHANNEL_NAME peer0.org2.example.com $org2token

	echo "---> get Installed Chaincode info"
	queryInstalledChaincodes $_CHANNEL_NAME peer0.org1.example.com $org1token | tee /tmp/installedcc

	echo "---> make sure cc $_CC_NAME (ver: $_CC_VERSION) is installed"
	install_cc $_CHANNEL_NAME peer0.org1.example.com $org1token $_CC_NAME $_CC_SRC_PATH $_CC_VERSION || return 1
	install_cc $_CHANNEL_NAME peer1.org1.example.com $org1token $_CC_NAME $_CC_SRC_PATH $_CC_VERSION || return 1
	install_cc $_CHANNEL_NAME peer0.org2.example.com $org2token $_CC_NAME $_CC_SRC_PATH $_CC_VERSION || return 1
	install_cc $_CHANNEL_NAME peer1.org2.example.com $org2token $_CC_NAME $_CC_SRC_PATH $_CC_VERSION || return 1

	echo "---> make sure chaincode $_CC_NAME (ver: $_CC_VERSION) is instantiated"
	instantiate_cc $_CHANNEL_NAME peer0.org1.example.com $org1token $_CC_NAME $_CC_VERSION /app/artifacts/src/examples/chaincode/go/marbles02_private/collections_config_sdk.json "$_ENDORSEMENT_POLICY" || return 1

	echo "---> invoke Chaincode (service discovery: $_USE_SERVICE_DISCOVERY)"
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" initMarble "[\"marble1\",\"blue\",\"35\",\"Tom\",\"99\"]"
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarble "[\"marble1\"]"
	call_marble $_USER_NAME2 $_ORG_NAME2 "$(get_target $_ORG_NAME2)" readMarble "[\"marble1\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo0
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarblePrivateDetails "[\"marble1\"]"
	call_marble $_USER_NAME2 $_ORG_NAME2 "$(get_target $_ORG_NAME2)" readMarble "[\"marble1\"]"
	call_marble $_USER_NAME2 $_ORG_NAME2 "$(get_target $_ORG_NAME2)" readMarblePrivateDetails "[\"marble1\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo1
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarblePrivateDetails "[\"marble1\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo2
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" initMarble "[\"marble2\",\"red\",\"50\",\"Tom\",\"78\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo3
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" initMarble "[\"marble3\",\"blue\",\"70\",\"Tom\",\"95\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo4
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" transferMarble "[\"marble2\",\"joe\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo5
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarblePrivateDetails "[\"marble1\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo6
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" transferMarble "[\"marble2\",\"tom\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo7
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarblePrivateDetails "[\"marble1\"]"
	queryChainInfo $_CHANNEL_NAME peer0.org1.example.com $org1token > /tmp/chaininfo8
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" transferMarblesBasedOnColor "[\"blue\",\"jerry\"]"
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" readMarble "[\"marble1\"]"
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" getMarblesByRange "[\"marble1\",\"marble3\"]"
	call_marble $_USER_NAME1 $_ORG_NAME1 "$(get_target $_ORG_NAME1)" delete "[\"marble1\"]"
}
