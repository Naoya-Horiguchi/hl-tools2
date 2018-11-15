[ ! "$_CHANNEL_NAME" ] && _CHANNEL_NAME=mychannel
[ ! "$_CC_NAME" ] && _CC_NAME=marblecc
[ ! "$_CC_VERSION" ] && _CC_VERSION=v1
[ ! "$_USER_NAME1" ] && _USER_NAME1=Jim
[ ! "$_ORG_NAME1" ] && _ORG_NAME1=org1
[ ! "$_USER_NAME2" ] && _USER_NAME2=Barry
[ ! "$_ORG_NAME2" ] && _ORG_NAME2=org2

[ ! "$_CC_SRC_PATH" ] && __CC_SRC_PATH=chaincode/go/marbles02

call_marble() {
	local peers="$1"
    local func=$2
	local args=$3

	echo "---> call function '$func' with $args" >&2
	invokeChaincode "$(get_token $_USER_NAME1 $_ORG_NAME1)" $_CHANNEL_NAME $_CC_NAME "$peers" $func "$args"
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

	echo "---> make sure chaincode marblesp (ver: $_CC_VERSION) is instantiated"
	instantiate_cc $_CHANNEL_NAME peer0.org1.example.com $org1token $_CC_NAME $_CC_VERSION "" "$_ENDORSEMENT_POLICY" || return 1

	local target="[\"peer0.org1.example.com\",\"peer1.org1.example.com\"]"
	if [ "$_USE_SERVICE_DISCOVERY" == true ] ; then
		target="\"peer0.org1.example.com\""
	fi

	echo "---> invoke Chaincode (service discovery: $_USE_SERVICE_DISCOVERY)"
	call_marble "$target" initMarble "[\"marble1\",\"blue\",\"35\",\"Tom\"]"
	call_marble "$target" readMarble "[\"marble1\"]"
	call_marble "$target" initMarble "[\"marble2\",\"red\",\"50\",\"Tom\"]"
	call_marble "$target" initMarble "[\"marble3\",\"blue\",\"70\",\"Tom\"]"
	call_marble "$target" transferMarble "[\"marble2\",\"jerry\"]"
	call_marble "$target" transferMarblesBasedOnColor "[\"blue\",\"jerry\"]"
	call_marble "$target" readMarble "[\"marble1\"]"
	call_marble "$target" getMarblesByRange "[\"marble1\",\"marble3\"]"
	call_marble "$target" getHistoryForMarble "[\"marble1\"]"
	call_marble "$target" delete "[\"marble1\"]"
}
