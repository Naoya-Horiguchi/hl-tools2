# Simple testing uses default chaincode (ie. ones defined in fabric network boot up,
# which is chaincode_example02.go in most cases), so this testcase fails if
# chaincode_example02 is not installed in the channel.

# These can be defined in config files of each testcase.
[ ! "$_CHANNEL_NAME" ] && _CHANNEL_NAME=mychannel
[ ! "$_CC_NAME" ] && _CC_NAME=mycc
[ ! "$_USER_NAME" ] && _USER_NAME=Jim
[ ! "$_ORG_NAME" ] && _ORG_NAME=org1

# should be like _PEERS="\"peer0.org1.example.com\"" if service discovery is enabled.
[ ! "$_PEERS" ] && _PEERS="[\"peer0.org1.example.com\",\"peer0.org2.example.com\"]"

move_value() {
	local sender=$1
	local receiver=$2
	local value=$3
	local peers="$4"

	if [ "$_USE_SUBMIT_TRANSACTION" ] ; then
		echo "---> Move $value from account $sender to account $receiver (use submitTransaction)"
		invokeChaincode "$(get_token $_USER_NAME $_ORG_NAME)" $_CHANNEL_NAME $_CC_NAME "$peers" invoke "[\"$sender\",\"$receiver\",\"$value\"]" "true"
	else
		echo "---> Move $value from account $sender to account $receiver"
		invokeChaincode "$(get_token $_USER_NAME $_ORG_NAME)" $_CHANNEL_NAME $_CC_NAME "$peers" invoke "[\"$sender\",\"$receiver\",\"$value\"]" ""
	fi
}

scenario() {
	echo "---> request_token"
	request_token $_USER_NAME $_ORG_NAME

	echo "---> query channels"
	queryChannels peer0.org1.example.com $(get_token $_USER_NAME $_ORG_NAME)

	echo "---> get Installed Chaincode info"
	queryInstalledChaincodes $_CHANNEL_NAME peer0.org1.example.com $(get_token $_USER_NAME $_ORG_NAME) | tee /tmp/installedcc

	echo "---> get Instantiated Chaincode info"
	queryInstantiatedChaincodes $_CHANNEL_NAME peer0.org1.example.com $(get_token $_USER_NAME $_ORG_NAME) | tee /tmp/instantiatedcc

	echo "---> query variable a in chaincode $_CC_NAME"
	queryChaincode $_CHANNEL_NAME "${PEER}" "$(get_token $_USER_NAME $_ORG_NAME)" $_CC_NAME a
	echo "---> query variable b in chaincode $_CC_NAME"
	queryChaincode $_CHANNEL_NAME "${PEER}" "$(get_token $_USER_NAME $_ORG_NAME)" $_CC_NAME b

	echo "---> moving value 13 from a to b (service discovery: $_USE_SERVICE_DISCOVERY)"
	move_value b a 13 "$_PEERS"

	echo "---> query variable a in chaincode $_CC_NAME"
	queryChaincode $_CHANNEL_NAME "${PEER}" "$(get_token $_USER_NAME $_ORG_NAME)" $_CC_NAME a
	echo "---> query variable b in chaincode $_CC_NAME"
	queryChaincode $_CHANNEL_NAME "${PEER}" "$(get_token $_USER_NAME $_ORG_NAME)" $_CC_NAME b
}

# TODO: need proper check to decide that service discovery really works
log_check() {
	if grep -q "\[ERROR\]" $LOGDIR/$TESTCASE/app.log ; then
		local lines=$(grep "\[ERROR\]" $LOGDIR/$TESTCASE/app.log | wc -l)
		echo "app.log has $lines ERROR log events"
		return 1
	fi
}
