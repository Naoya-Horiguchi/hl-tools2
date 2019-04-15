. libs/test_utils.sh

. cases/config

[ ! "$RUNNAME" ]     && export RUNNAME=default

[ ! "$HOST" ]        && export HOST=localhost
[ ! "$PORT" ]        && export PORT=4000

[ ! "$ACCEPT" ]      && export ACCEPT=application/json # or text/html or whatever

##<2018-11-13 Tue 18:11> # TODO: these should be got from network-config.yaml
##<2018-11-13 Tue 18:11> [ ! "$CHANNEL" ]     && export CHANNEL=mychannel
##<2018-11-13 Tue 18:11> [ ! "$PEER" ]        && export PEER=peer0.org1.example.com
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> # used only for DEBUGGING when CONFIG_JWT=false
##<2018-11-13 Tue 18:11> # [ ! "$USERNAME" ]    && export USERNAME=Jim
##<2018-11-13 Tue 18:11> # [ ! "$ORGNAME" ]     && export ORGNAME=org1
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> # default settings
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> [ ! "$FABRIC_CONFIG" ] && FABRIC_CONFIG=config
##<2018-11-13 Tue 18:11> [ -s "$FABRIC_CONFIG" ] && source $FABRIC_CONFIG
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> # Need to load from config file
##<2018-11-13 Tue 18:11> export FABRIC_DIR
##<2018-11-13 Tue 18:11> export FABRIC_VER
##<2018-11-13 Tue 18:11> export FABRIC_CA_DIR
##<2018-11-13 Tue 18:11> export FABRIC_CA_VER
##<2018-11-13 Tue 18:11> export FABRIC_SDK_NODE_DIR
##<2018-11-13 Tue 18:11> export FABRIC_SDK_NODE_VER
##<2018-11-13 Tue 18:11> export FABRIC_NETWORK_DIR
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> export TMPD=$(mktemp -d)
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> . $(dirname $BASH_SOURCE)/../../scripts/common.sh
##<2018-11-13 Tue 18:11> . lib/test_utils.sh
##<2018-11-13 Tue 18:11> 
##<2018-11-13 Tue 18:11> load_testcase_config config
##<2018-11-13 Tue 18:11> 
# if [ ! -d "$FABRIC_NETWORK_DIR" ] ; then
# 	echo "FABRIC_NETWORK_DIR '$FABRIC_NETWORK_DIR' not exist."
# 	exit 1
# fi

# if [ ! -d "$FABRIC_DIR" ] ; then
# 	echo "FABRIC_DIR '$FABRIC_DIR' not exist."
# 	exit 1
# fi

# if [ ! -d "$FABRIC_SDK_NODE_DIR" ] ; then
# 	echo "FABRIC_SDK_NODE_DIR '$FABRIC_SDK_NODE_DIR' not exist."
# 	exit 1
# fi
