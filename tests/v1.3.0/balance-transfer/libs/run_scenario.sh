# TODO: how to order scenarios/testcases?

run_scenario() {
	local dir=$1

	echo "===> start scenario $dir"
	load_testcase_config $dir

	local testcases="$(find $dir -maxdepth 1 -mindepth 1 -type f | grep -v /config$)"
	if [ "$TESTCASES" ] ; then
		local tmp_testcases=""
		for tmptc1 in $testcases ; do
			for tmptc2 in $TESTCASES ; do
				if [ "${tmptc1}" == "${tmptc2}" ] ; then
					tmp_testcases="$tmp_testcases ${tmptc1}"
				fi
			done
		done
		testcases="$tmp_testcases"
	fi

	if [ "$testcases" ] ; then
		make cleanup_containers

		echo "start_fabric_network for $testcases"
		start_fabric_network
		sleep 2

		for testcase in $testcases ; do
			TESTCASE=${testcase} bash libs/run_single_testcase.sh
		done

		collect_fabric_network_logs $dir

		# keep containers running for debugging
		if [ ! "$DEBUG" ] ; then
			stop_fabric_network
		fi
	fi

	echo "<=== finish scenario $dir"
}

. libs/test_utils.sh
. libs/collect_logs.sh

# order?
for scenario in $(find cases -type f | grep -v /config$ | xargs -r dirname | sort | uniq) ; do
	echo "===> run_scenario $scenario"
	run_scenario $scenario
	echo "<=== finished scenario $scenario"
done
