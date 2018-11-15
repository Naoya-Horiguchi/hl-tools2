# Common routines

# TODO: get token from target peer more elegantly
# peername -> orgname -> orgtoken
get_token() {
	if [ "$#" -eq 1 ] ; then
		local peer=$1

		if [[ "$peer" =~ org1 ]] ; then
			find $CREDENTIAL_STORE_DIR/ -type f | grep -i org1 | head -n1 | xargs cat
		elif [[ "$peer" =~ org2 ]] ; then
			find $CREDENTIAL_STORE_DIR/ -type f | grep -i org2 | head -n1 | xargs cat
		else
			echo "Failed to get token for $peer" >&2
			exit 1
		fi
	else
		local username=$1
		local orgname=$2

		if [ -s $CREDENTIAL_STORE_DIR-$orgname/token.$username ] ; then
			cat $CREDENTIAL_STORE_DIR-$orgname/token.$username
		else
			echo "Token not found" >&2
			return 1
		fi
	fi
}

request_token() {
	local username=$1
	local orgname=$2

	if [ -s $CREDENTIAL_STORE_DIR-$orgname/tmp.$username ] ; then
		echo "token ' $CREDENTIAL_STORE_DIR-$orgname/tmp.$username' already exists."
	else
		echo requestToken "$username" "$orgname"
		requestToken "$username" "$orgname"
		echo ''
	fi
}

get_rand() {
	od -An -N1 -i /dev/random | tr -d ' '
}

mkdir_if_not_exist() {
	local dir=$1

	[ ! -d "$dir" ] && mkdir -p $dir
}

# API routines

requestToken() {
	local username=$1
	local orgname=$2

	curl -s -X POST \
		 http://$HOST:$PORT/users \
		 -H "content-type: application/x-www-form-urlencoded" \
		 -d "username=${username}&orgName=${orgname}"
}

createChannel() {
	local channelname=$1
	local channelconfigpath=$2
	local token=$3

	curl -s -X POST \
		 http://$HOST:$PORT/channels \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json" \
		 -d "{
		\"channelName\":\"$channelname\",
		\"channelConfigPath\":\"$channelconfigpath\"
	}"
	echo
}

joinChannel() {
	local channel=$1
	local peers="$2"
	local token=$3

	curl -s -X POST \
		 http://$HOST:$PORT/channels/${channel}/peers \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json" \
		 -d "{
		\"peers\": $peers
	}"
	echo
}

installChaincode() {
	local token=$1
	local peers="$2" # TODO: format?
	local chaincodename=$3
	local chaincodepath=$4
	local chaincodetype=$5
	local chaincodeversion=$6

	curl -s -X POST \
		 http://$HOST:$PORT/chaincodes \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json" \
		 -d "{
		\"peers\": $peers,
		\"chaincodeName\":\"$chaincodename\",
		\"chaincodePath\":\"$chaincodepath\",
		\"chaincodeType\": \"$chaincodetype\",
		\"chaincodeVersion\":\"$chaincodeversion\"
	}"
	echo ""
}

instantiateChaincode() {
	local token=$1
	local channel=$2
	local peers="$3"
	local chaincodename=$4
	local chaincodetype=$5
	local chaincodeversion=$6
	local args="$7" # TODO: format?

	curl -s -X POST \
		 http://$HOST:$PORT/channels/${channel}/chaincodes \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json" \
		 -d "{
		\"peers\": $peers,
		\"chaincodeName\":\"$chaincodename\",
		\"chaincodeVersion\":\"$chaincodeversion\",
		\"chaincodeType\": \"$chaincodetype\",
		\"args\": $args
	}"
	echo
}

invokeChaincode() {
	local token=$1
	local channel=$2
	local ccid=$3
	local peers="$4" # TODO: format?
	local fcn=$5
	local args="$6" # TODO: format?
	local newif="$7" # using submitTransaction() if true

	local peers_str=
	if [ "$peers" ] ; then
		peers_str="\"peers\": $peers,"
	fi

	local newif_str=
	if [ "$newif" ] ; then
		newif_str="\"newif\": true,"
	fi

	curl -s -X POST \
		 http://$HOST:$PORT/channels/${channel}/chaincodes/${ccid} \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer ${token}" \
		 -H "content-type: application/json" \
		 -d "{
		$peers_str $newif_str
		\"fcn\": \"$fcn\",
		\"args\": $args
	}"
	echo
}

queryChaincode() {
	local channel=$1
	local peer=$2
	local token=$3
	local ccid=$4
	local arg=$5

	curl -s -G --data-urlencode "args=[\"$arg\"]" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/x-www-form-urlencoded" \
		 "http://$HOST:$PORT/channels/${channel}/chaincodes/${ccid}?peer=${peer}&fcn=query"
	echo
}

queryBlockByNumber() {
	local channel=$1
	local peer=$2
	local token=$3
	local number=$4

	curl -s -X GET \
		 "http://$HOST:$PORT/channels/${channel}/blocks/${number}?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

queryBlocks() {
	local channel=$1
	local peer=$2
	local token=$3

	curl -s -X GET \
		 "http://$HOST:$PORT/channels/${channel}/blocks?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

queryTransactionByTxID() {
	local channel=$1
	local peer=$2
	local token=$3
	local txid=$4

	curl -s -X GET http://$HOST:$PORT/channels/${channel}/transactions/${txid}?peer=${peer} \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

queryChannels() {
	local peer=$1
	local token=$2

	curl -s -X GET \
		 "http://$HOST:$PORT/channels?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

queryChainInfo() {
	local channel=$1
	local peer=$2
	local token=$3

	curl -s -X GET \
		 "http://$HOST:$PORT/channels/${channel}?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

# Why no argument for channel?
queryInstalledChaincodes() {
	local channel=$1
	local peer=$2
	local token=$3

	curl -s -X GET \
		 "http://$HOST:$PORT/chaincodes?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

queryInstantiatedChaincodes() {
	local channel=$1
	local peer=$2
	local token=$3

	curl -s -X GET \
		 "http://$HOST:$PORT/channels/${channel}/chaincodes?peer=${peer}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

filter_raw_data() {
	local file=$1

	if [ "$file" ] ; then
		# cat $file | ruby -ne 'puts $_.gsub(/\[\d+,[\d,]+\]/, "\"[...]\"")'
		cat $file | ruby -ne 'puts $_.gsub(/(\[\d+,\d+,[\d,]+\])/) {|num| "\"" + num[1..-2].split(",").map {|x| "%02x" % x.to_i}.join + "\""}'
	else
		while read line ; do
			echo $line | ruby -ne 'puts $_.gsub(/(\[\d+,\d+,[\d,]+\])/) {|num| "\"" + num[1..-2].split(",").map {|x| "%02x" % x.to_i}.join + "\""}'
		done
	fi
}

setup_directory() {
	local config=$1

	RUN_DIR=$(jq ".run_dir" $config | tr -d \")
	RUN_DIR_OUTSIDE_DOCKER=$(jq ".run_dir_outside_docker" $config | tr -d \")
	if [ "$RUN_DIR_OUTSIDE_DOCKER" != null ] ; then
		echo "We have RUN_DIR_OUTSIDE_DOCKER ($RUN_DIR_OUTSIDE_DOCKER) setting ..."
		RUN_DIR=$RUN_DIR_OUTSIDE_DOCKER
	fi

	BC_DATA_DIR=$(jq ".bc_data_dir" $config | tr -d \")
	BC_DATA_DIR_OUTSIDE_DOCKER=$(jq ".bc_data_dir_outside_docker" $config | tr -d \")
	if [ "$BC_DATA_DIR_OUTSIDE_DOCKER" != null ] ; then
		echo "We have BC_DATA_DIR_OUTSIDE_DOCKER ($BC_DATA_DIR_OUTSIDE_DOCKER) setting ..."
		BC_DATA_DIR=$BC_DATA_DIR_OUTSIDE_DOCKER
	fi

	CREDENTIAL_STORE_DIR=$(jq ".credential_store_dir" $config | tr -d \")
	CREDENTIAL_STORE_DIR_OUTSIDE_DOCKER=$(jq ".credential_store_dir_outside_docker" $config | tr -d \")
	if [ "$CREDENTIAL_STORE_DIR_OUTSIDE_DOCKER" != null ] ; then
		CREDENTIAL_STORE_DIR=$CREDENTIAL_STORE_DIR_OUTSIDE_DOCKER
	fi

	SCRIPT_DIR=$(dirname $BASH_SOURCE)

	echo RUN_DIR: $RUN_DIR
	echo BC_DATA_DIR: $BC_DATA_DIR
	echo SCRIPT_DIR: $SCRIPT_DIR
	echo CREDENTIAL_STORE_DIR: $CREDENTIAL_STORE_DIR
	mkdir_if_not_exist "$RUN_DIR"
	mkdir_if_not_exist "$BC_DATA_DIR"
	mkdir_if_not_exist "$RUN_DIR/channels"
}

getIndexPage() {
	curl -s -X GET \
		 "http://$HOST:$PORT/summary" \
		 -H "Accept:$ACCEPT" \
		 -H "content-type: application/json"
	echo
}

getSummaryPage() {
	local token=$1

	curl -s -X GET \
		 "http://$HOST:$PORT/summary" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

# need service discovery support
getServices() {
	local token=$1
	local channel=$2
	local peer=$3
	local cc=$4
	local config=$5
	local local=$6

	curl -s -X GET \
		 "http://$HOST:$PORT/services?channel=${channel}&peer=${peer}&cc=${cc}&config=${config}&local=${local}" \
		 -H "Accept:$ACCEPT" \
		 -H "authorization: Bearer $token" \
		 -H "content-type: application/json"
	echo
}

jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
	echo
	exit 1
fi
