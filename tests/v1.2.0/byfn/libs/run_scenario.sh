# TODO: how to order scenarios/testcases?

run_scenario() {
	local scenario=$1

	echo "===> start scenario $scenario"
	load_testcase_config $scenario

	local testcases="$(find cases/$scenario -maxdepth 1 -mindepth 1 -type f | grep -v /config$)"
	if [ "$TESTCASES" ] ; then
		local tmp_testcases=""
		for tmptc1 in $testcases ; do
			for tmptc2 in $TESTCASES ; do
				if [ "${tmptc1##cases/}" == "${tmptc2##cases/}" ] ; then
					tmp_testcases="$tmp_testcases ${tmptc1##cases/}"
				fi
			done
		done
		testcases="$tmp_testcases"
	fi

	if [ "$testcases" ] ; then
		make cleanup_containers
		# TODO: need checking the target fabric images are tagged as 'testing'
		echo "start_fabric_network for $testcases"
		start_fabric_network

		for testcase in $testcases ; do
			TESTCASE=${testcase##cases/} bash libs/run_single_testcase.sh
		done

		collect_fabric_network_logs $scenario

		# keep containers running for debugging
		if [ ! "$DEBUG" ] ; then
			stop_fabric_network
		fi
	fi

	echo "<=== finish scenario $scenario"
}

. libs/test_utils.sh
. libs/collect_logs.sh

# order?
for scenario in $(find cases -type f | grep -v /config$ | xargs -r dirname | sort | uniq) ; do
	echo "===> run_scenario ${scenario##cases/}"
	run_scenario ${scenario##cases/}
	echo "<=== finished scenario ${scenario##cases/}"
done
