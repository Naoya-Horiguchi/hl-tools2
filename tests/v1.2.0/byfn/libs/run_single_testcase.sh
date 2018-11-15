# TESTCASE should be given via environment variable

export TESTCASE=${TESTCASE##cases/}
[ ! "$TESTCASE" ] && echo "TESTCASE not given" && exit 1
[ ! -f "cases/$TESTCASE" ] && echo "cases/$TESTCASE not found" && exit 1

echo "===> start testcase $TESTCASE"

. libs/env.sh
. libs/common.sh

. libs/application.sh
. libs/collect_logs.sh

load_testcase_config $TESTCASE
. cases/$TESTCASE

stop_application
start_application || exit 1 # TODO: how to check test result when abort?
sleep 1
# Call testcase specific test scenario.
scenario > $TMPD/stdout 2>&1
ret=$?
cat $TMPD/stdout
collect_application_logs $TESTCASE

# keep application running for debugging
if [ ! "$DEBUG" ] ; then
	stop_application
fi

decide_pass_fail $ret $TESTCASE

echo "<=== finish testcase $TESTCASE"
