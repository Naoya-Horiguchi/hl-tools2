check_cc_installed() {
	local channel=$1
	local peer=$2
	local token=$3
	local cc=$4
	local cc_ver=$5

	queryInstalledChaincodes $channel $peer $token > /tmp/installedcc

	local installed=
	if jq '.data[] | (.name + "@" + .version)' /tmp/installedcc | grep -q "$cc@$cc_ver" ; then
		return 0
	elif jq '.data[] | (.name + "@" + .version)' /tmp/installedcc | grep -q "$cc@" ; then
		return 1
	fi
	return 2
}

install_cc() {
	local channel=$1
	local peer=$2
	local token=$3
	local cc=$4
	local cc_path=$5
	local cc_ver=$6

	if ! check_cc_installed $channel $peer $token $cc $cc_ver ; then
	 	echo "---> install Chaincode $cc (ver: $cc_ver)"
	 	installChaincode $token "[\"$peer\"]" "$cc" "$cc_path" "golang" "$cc_ver"

		if ! check_cc_installed $channel $peer $token $cc $cc_ver ; then
			echo "!!! Failed to instantiate chaincode $cc:$cc_ver" >&2
			return 1
		fi
	fi
}

# return 0: version $cc_ver of chaincode $cc is running (instantiated)
# return 1: chaincode $cc is running (instantiated), but the version is not $cc_ver
# return 2: no chaincode $cc is running
#
check_cc_instantiated() {
	local channel=$1
	local peer=$2
	local token=$3
	local cc=$4
	local cc_ver=$5

	queryInstantiatedChaincodes $channel $peer $token > /tmp/instantiatedcc

	local instantiated=
	if jq '.data[] | (.name + "@" + .version)' /tmp/instantiatedcc | grep -q "$cc@$cc_ver" ; then
		return 0
	elif jq '.data[] | (.name + "@" + .version)' /tmp/instantiatedcc | grep -q "$cc@" ; then
		return 1
	fi
	return 2
}

instantiate_cc() {
	local channel=$1
	local peer=$2
	local token=$3
	local cc=$4
	local cc_ver=$5
	local private=$6 # given path for collection definition file
	local endorsement_policy=$7

	check_cc_instantiated $channel $peer $token $cc $cc_ver
	local ret_instantiated=$?
	if [ $ret_instantiated -eq 0 ] ; then
		return 0
	fi
	local update=
	if [ $ret_instantiated -eq 2 ] ; then # need deploy
		update=false
	elif [ $ret_instantiated -eq 1 ] ; then # need update
		update=true
	fi

	instantiateChaincode $token $channel "[\"$peer\"]" "$cc" golang "$cc_ver" "{\"endorsementPolicy\": ${endorsement_policy:-null}, \"update\": $update, \"collectionFile\": \"${private:-null}\"}"

	if ! check_cc_instantiated $channel $peer $token $cc $cc_ver ; then
		echo "!!! Failed to instantiate chaincode $cc:$cc_ver" >&2
		return 1
	fi
	return 0
}
